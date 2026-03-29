#![no_std]

mod errors;
mod events;
mod types;

#[cfg(test)]
mod test;

use errors::EscrowError;
use soroban_sdk::{
    contract, contractimpl,
    token::Client as TokenClient,
    Address, Bytes, BytesN, Env,
};
use types::{DataKey, EscrowRecord, EscrowStatus, RECORD_TTL};

fn get_admin(env: &Env) -> Result<Address, EscrowError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(EscrowError::Unauthorized)
}

fn load_escrow(env: &Env, id: &BytesN<32>) -> Result<EscrowRecord, EscrowError> {
    env.storage()
        .persistent()
        .get(&DataKey::Escrow(id.clone()))
        .ok_or(EscrowError::EscrowNotFound)
}

fn save_escrow(env: &Env, id: &BytesN<32>, record: &EscrowRecord) {
    env.storage()
        .persistent()
        .set(&DataKey::Escrow(id.clone()), record);
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::Escrow(id.clone()), RECORD_TTL, RECORD_TTL);
}

fn derive_escrow_id(env: &Env, sender: &Address, recipient: &Address, amount: i128, expires_at: u64) -> BytesN<32> {
    let mut buf = Bytes::new(env);
    buf.append(&sender.to_xdr(env));
    buf.append(&recipient.to_xdr(env));
    buf.append(&Bytes::from_array(env, &amount.to_be_bytes()));
    buf.append(&Bytes::from_array(env, &expires_at.to_be_bytes()));
    buf.append(&Bytes::from_array(env, &env.ledger().timestamp().to_be_bytes()));
    env.crypto().sha256(&buf)
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), EscrowError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(EscrowError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn create_escrow(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        condition_hash: BytesN<32>,
        timeout: u64,
    ) -> Result<BytesN<32>, EscrowError> {
        sender.require_auth();
        let expires_at = env.ledger().timestamp() + timeout;
        let escrow_id = derive_escrow_id(&env, &sender, &recipient, amount, expires_at);

        TokenClient::new(&env, &token).transfer(&sender, &env.current_contract_address(), &amount);

        let record = EscrowRecord {
            sender: sender.clone(),
            recipient: recipient.clone(),
            token,
            amount,
            condition_hash,
            expires_at,
            status: EscrowStatus::Active,
        };
        save_escrow(&env, &escrow_id, &record);
        events::emit_escrow_created(&env, &escrow_id, &sender, &recipient, amount);
        Ok(escrow_id)
    }

    pub fn release_escrow(
        env: Env,
        escrow_id: BytesN<32>,
        condition_preimage: Bytes,
    ) -> Result<(), EscrowError> {
        let mut record = load_escrow(&env, &escrow_id)?;
        if record.status != EscrowStatus::Active {
            return Err(EscrowError::EscrowNotActive);
        }
        record.recipient.require_auth();

        let hash = env.crypto().sha256(&condition_preimage);
        if hash != record.condition_hash {
            return Err(EscrowError::InvalidCondition);
        }

        record.status = EscrowStatus::Released;
        let recipient = record.recipient.clone();
        let amount = record.amount;
        let token = record.token.clone();
        save_escrow(&env, &escrow_id, &record);

        TokenClient::new(&env, &token).transfer(&env.current_contract_address(), &recipient, &amount);
        events::emit_escrow_released(&env, &escrow_id, &recipient, amount);
        Ok(())
    }

    pub fn refund_escrow(env: Env, escrow_id: BytesN<32>) -> Result<(), EscrowError> {
        let mut record = load_escrow(&env, &escrow_id)?;
        if record.status != EscrowStatus::Active {
            return Err(EscrowError::EscrowNotActive);
        }
        if env.ledger().timestamp() <= record.expires_at {
            return Err(EscrowError::TimeoutNotReached);
        }
        record.sender.require_auth();

        record.status = EscrowStatus::Refunded;
        let sender = record.sender.clone();
        let amount = record.amount;
        let token = record.token.clone();
        save_escrow(&env, &escrow_id, &record);

        TokenClient::new(&env, &token).transfer(&env.current_contract_address(), &sender, &amount);
        events::emit_escrow_refunded(&env, &escrow_id, &sender, amount);
        Ok(())
    }

    pub fn dispute_escrow(env: Env, disputer: Address, escrow_id: BytesN<32>) -> Result<(), EscrowError> {
        let mut record = load_escrow(&env, &escrow_id)?;
        if record.status != EscrowStatus::Active {
            return Err(EscrowError::EscrowNotActive);
        }
        // Either sender or recipient can dispute
        disputer.require_auth();
        if disputer != record.sender && disputer != record.recipient {
            return Err(EscrowError::Unauthorized);
        }
        record.status = EscrowStatus::Disputed;
        save_escrow(&env, &escrow_id, &record);
        events::emit_escrow_disputed(&env, &escrow_id);
        Ok(())
    }

    pub fn resolve_dispute(
        env: Env,
        escrow_id: BytesN<32>,
        recipient_share: i128,
    ) -> Result<(), EscrowError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let mut record = load_escrow(&env, &escrow_id)?;
        if record.status != EscrowStatus::Disputed {
            return Err(EscrowError::NotDisputed);
        }
        if recipient_share > record.amount {
            return Err(EscrowError::InvalidSplit);
        }

        let sender_share = record.amount - recipient_share;
        let token = record.token.clone();
        let recipient = record.recipient.clone();
        let sender = record.sender.clone();
        record.status = EscrowStatus::Released;
        save_escrow(&env, &escrow_id, &record);

        let contract = env.current_contract_address();
        if recipient_share > 0 {
            TokenClient::new(&env, &token).transfer(&contract, &recipient, &recipient_share);
        }
        if sender_share > 0 {
            TokenClient::new(&env, &token).transfer(&contract, &sender, &sender_share);
        }
        events::emit_dispute_resolved(&env, &escrow_id, recipient_share, sender_share);
        Ok(())
    }

    pub fn get_escrow(env: Env, escrow_id: BytesN<32>) -> Result<EscrowRecord, EscrowError> {
        load_escrow(&env, &escrow_id)
    }
}
