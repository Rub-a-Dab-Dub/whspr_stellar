#![no_std]

mod errors;
mod events;
mod types;

#[cfg(test)]
mod test;

use errors::AirdropError;
use soroban_sdk::{
    contract, contractimpl,
    token::Client as TokenClient,
    Address, Bytes, BytesN, Env, Vec,
};
use types::{CampaignRecord, DataKey, RECORD_TTL};

fn get_admin(env: &Env) -> Result<Address, AirdropError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(AirdropError::Unauthorized)
}

fn load_campaign(env: &Env, id: &BytesN<32>) -> Result<CampaignRecord, AirdropError> {
    env.storage()
        .persistent()
        .get(&DataKey::Campaign(id.clone()))
        .ok_or(AirdropError::CampaignNotFound)
}

fn save_campaign(env: &Env, id: &BytesN<32>, record: &CampaignRecord) {
    env.storage()
        .persistent()
        .set(&DataKey::Campaign(id.clone()), record);
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::Campaign(id.clone()), RECORD_TTL, RECORD_TTL);
}

/// Compute SHA-256 of two 32-byte nodes (sorted) for Merkle tree.
fn hash_pair(env: &Env, a: &BytesN<32>, b: &BytesN<32>) -> BytesN<32> {
    let (lo, hi) = if a.to_array() <= b.to_array() { (a, b) } else { (b, a) };
    let mut buf = Bytes::new(env);
    buf.append(&Bytes::from_array(env, &lo.to_array()));
    buf.append(&Bytes::from_array(env, &hi.to_array()));
    env.crypto().sha256(&buf)
}

pub fn verify_merkle_proof(
    env: &Env,
    proof: &Vec<BytesN<32>>,
    root: &BytesN<32>,
    leaf: &BytesN<32>,
) -> bool {
    let mut current = leaf.clone();
    for node in proof.iter() {
        current = hash_pair(env, &current, &node);
    }
    &current == root
}

#[contract]
pub struct AirdropContract;

#[contractimpl]
impl AirdropContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), AirdropError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(AirdropError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn create_campaign(
        env: Env,
        token: Address,
        total_amount: i128,
        merkle_root: BytesN<32>,
        start: u64,
        end: u64,
    ) -> Result<BytesN<32>, AirdropError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        if end <= start {
            return Err(AirdropError::InvalidTimeRange);
        }

        // Transfer tokens from admin to contract
        TokenClient::new(&env, &token).transfer(&admin, &env.current_contract_address(), &total_amount);

        // Derive campaign id from merkle root + start + end
        let mut id_bytes = Bytes::new(&env);
        id_bytes.append(&Bytes::from_array(&env, &merkle_root.to_array()));
        id_bytes.append(&Bytes::from_array(&env, &start.to_be_bytes()));
        id_bytes.append(&Bytes::from_array(&env, &end.to_be_bytes()));
        let campaign_id = env.crypto().sha256(&id_bytes);

        let record = CampaignRecord {
            token: token.clone(),
            total_amount,
            claimed_amount: 0,
            merkle_root,
            start,
            end,
            is_active: true,
        };
        save_campaign(&env, &campaign_id, &record);

        events::emit_campaign_created(&env, &campaign_id, &token, total_amount);
        Ok(campaign_id)
    }

    pub fn claim(
        env: Env,
        claimer: Address,
        campaign_id: BytesN<32>,
        amount: i128,
        merkle_proof: Vec<BytesN<32>>,
    ) -> Result<(), AirdropError> {
        claimer.require_auth();

        let mut campaign = load_campaign(&env, &campaign_id)?;

        if !campaign.is_active {
            return Err(AirdropError::CampaignNotActive);
        }
        let now = env.ledger().timestamp();
        if now < campaign.start {
            return Err(AirdropError::CampaignNotStarted);
        }
        if now > campaign.end {
            return Err(AirdropError::CampaignExpired);
        }

        let claimed_key = DataKey::Claimed(campaign_id.clone(), claimer.clone());
        if env.storage().persistent().has(&claimed_key) {
            return Err(AirdropError::AlreadyClaimed);
        }

        // Build leaf: sha256(claimer_bytes || amount_bytes)
        let claimer_bytes = claimer.to_xdr(&env);
        let mut leaf_input = Bytes::new(&env);
        leaf_input.append(&claimer_bytes);
        leaf_input.append(&Bytes::from_array(&env, &amount.to_be_bytes()));
        let leaf = env.crypto().sha256(&leaf_input);

        if !verify_merkle_proof(&env, &merkle_proof, &campaign.merkle_root, &leaf) {
            return Err(AirdropError::InvalidMerkleProof);
        }

        env.storage().persistent().set(&claimed_key, &true);
        env.storage().persistent().extend_ttl(&claimed_key, RECORD_TTL, RECORD_TTL);

        campaign.claimed_amount += amount;
        save_campaign(&env, &campaign_id, &campaign);

        TokenClient::new(&env, &campaign.token).transfer(
            &env.current_contract_address(),
            &claimer,
            &amount,
        );

        events::emit_claimed(&env, &campaign_id, &claimer, amount);
        Ok(())
    }

    pub fn cancel_campaign(env: Env, campaign_id: BytesN<32>) -> Result<(), AirdropError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let mut campaign = load_campaign(&env, &campaign_id)?;
        if !campaign.is_active {
            return Err(AirdropError::CampaignNotActive);
        }

        let unclaimed = campaign.total_amount - campaign.claimed_amount;
        campaign.is_active = false;
        save_campaign(&env, &campaign_id, &campaign);

        if unclaimed > 0 {
            TokenClient::new(&env, &campaign.token).transfer(
                &env.current_contract_address(),
                &admin,
                &unclaimed,
            );
        }

        events::emit_campaign_cancelled(&env, &campaign_id, unclaimed);
        Ok(())
    }

    pub fn get_campaign(env: Env, campaign_id: BytesN<32>) -> Result<CampaignRecord, AirdropError> {
        load_campaign(&env, &campaign_id)
    }

    pub fn has_claimed(env: Env, campaign_id: BytesN<32>, address: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Claimed(campaign_id, address))
    }
}
