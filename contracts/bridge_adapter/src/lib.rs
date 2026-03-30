#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Bytes, BytesN, Env, Symbol,
};

/// Seconds after lock before depositor may refund if relay is incomplete.
pub const REFUND_TIMEOUT_SECS: u64 = 86_400;

const DOM_DEPOSIT: &[u8] = b"WHSPR/BRIDGE/DEPOSIT/v1\0";

pub type DepositId = BytesN<32>;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DepositStatus {
    Pending,
    Relayed,
    Completed,
    Refunded,
}

/// Bridge-side lock record: tokens are held until `Completed` or `Refunded`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BridgeDeposit {
    pub depositor: Address,
    pub token: Address,
    pub amount: i128,
    pub target_chain: u32,
    pub target_address: Bytes,
    /// Monotonic per-contract sequence at lock time; binds relay intent and prevents replay.
    pub nonce: u64,
    pub status: DepositStatus,
    pub locked_at: u64,
    /// EVM (or other dest) tx hash, agreed upon by relayers after first confirmation.
    pub dest_tx_hash: Bytes,
    pub relay_confirmations: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayerRecord {
    pub relayer: Address,
    pub is_active: bool,
    pub total_relayed: u64,
    pub added_at: u64,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    RelayerThreshold,
    NextDepositSeq,
    Deposit(DepositId),
    Relayer(Address),
    DepositRelayConf(DepositId, Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    InvalidThreshold = 5,
    DepositNotFound = 6,
    InvalidDepositStatus = 7,
    NotActiveRelayer = 8,
    AlreadyConfirmed = 9,
    DestTxHashMismatch = 10,
    RefundTooEarly = 11,
    NotDepositor = 12,
    RelayerAlreadyActive = 13,
    RelayerNotFound = 14,
    InvalidTargetAddress = 15,
    SequenceOverflow = 16,
    InvalidTxHash = 17,
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), ContractError> {
    admin.require_auth();
    let stored: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(ContractError::NotInitialized)?;
    if stored != *admin {
        return Err(ContractError::Unauthorized);
    }
    Ok(())
}

fn append_address_strkey(_env: &Env, buf: &mut Bytes, addr: &Address) {
    let s = addr.to_string();
    let n = s.len() as usize;
    if n > 96 {
        panic!();
    }
    let mut tmp = [0u8; 96];
    s.copy_into_slice(&mut tmp[..n]);
    buf.extend_from_slice(&tmp[..n]);
}

fn next_deposit_id(env: &Env) -> Result<(DepositId, u64), ContractError> {
    let mut seq: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextDepositSeq)
        .unwrap_or(0);
    seq = seq.checked_add(1).ok_or(ContractError::SequenceOverflow)?;
    env.storage()
        .instance()
        .set(&DataKey::NextDepositSeq, &seq);

    let mut pre = Bytes::new(env);
    pre.extend_from_slice(DOM_DEPOSIT);
    pre.extend_from_slice(&seq.to_be_bytes());
    let ca = env.current_contract_address();
    append_address_strkey(env, &mut pre, &ca);
    let id = env.crypto().sha256(&pre).to_bytes();
    Ok((id, seq))
}

fn load_deposit(env: &Env, id: &DepositId) -> Result<BridgeDeposit, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::Deposit(id.clone()))
        .ok_or(ContractError::DepositNotFound)
}

fn save_deposit(env: &Env, id: &DepositId, d: &BridgeDeposit) {
    env.storage()
        .persistent()
        .set(&DataKey::Deposit(id.clone()), d);
}

fn load_relayer(env: &Env, relayer: &Address) -> Result<RelayerRecord, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::Relayer(relayer.clone()))
        .ok_or(ContractError::RelayerNotFound)
}

#[contract]
pub struct BridgeAdapterContract;

#[contractimpl]
impl BridgeAdapterContract {
    /// Initialize bridge admin and M-of-N threshold (M) for relay finality.
    pub fn initialize(env: Env, admin: Address, relayer_threshold: u32) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        if relayer_threshold == 0 {
            return Err(ContractError::InvalidThreshold);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::RelayerThreshold, &relayer_threshold);
        env.storage().instance().set(&DataKey::NextDepositSeq, &0_u64);
        Ok(())
    }

    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn get_relayer_threshold(env: Env) -> Result<u32, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::RelayerThreshold)
            .ok_or(ContractError::NotInitialized)
    }

    /// Lock `amount` of Soroban `token` into this contract and emit bridge metadata.
    pub fn lock_and_bridge(
        env: Env,
        depositor: Address,
        token: Address,
        amount: i128,
        target_chain: u32,
        target_address: Bytes,
    ) -> Result<DepositId, ContractError> {
        depositor.require_auth();
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::NotInitialized);
        }
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }
        if target_address.is_empty() {
            return Err(ContractError::InvalidTargetAddress);
        }

        let (deposit_id, nonce) = next_deposit_id(&env)?;
        let ts = env.ledger().timestamp();
        let hold = env.current_contract_address();
        let client = token::Client::new(&env, &token);
        client.transfer(&depositor, &hold, &amount);

        let record = BridgeDeposit {
            depositor: depositor.clone(),
            token: token.clone(),
            amount,
            target_chain,
            target_address: target_address.clone(),
            nonce,
            status: DepositStatus::Pending,
            locked_at: ts,
            dest_tx_hash: Bytes::new(&env),
            relay_confirmations: 0,
        };
        save_deposit(&env, &deposit_id, &record);

        env.events().publish(
            (
                Symbol::new(&env, "bridge_lock"),
                deposit_id.clone(),
                depositor.clone(),
            ),
            (
                token,
                amount,
                target_chain,
                target_address,
                nonce,
                ts,
            ),
        );

        Ok(deposit_id)
    }

    /// A registered active relayer attests destination delivery. Requires Stellar `relayer`
    /// authorization (M-of-N unique relayers). `tx_hash` is the destination-chain tx id (bytes).
    pub fn confirm_relay(
        env: Env,
        relayer: Address,
        deposit_id: DepositId,
        tx_hash: Bytes,
    ) -> Result<(), ContractError> {
        relayer.require_auth();
        if tx_hash.is_empty() {
            return Err(ContractError::InvalidTxHash);
        }
        let threshold = Self::get_relayer_threshold(env.clone())?;
        let r = load_relayer(&env, &relayer)?;
        if !r.is_active {
            return Err(ContractError::NotActiveRelayer);
        }

        let conf_key = DataKey::DepositRelayConf(deposit_id.clone(), relayer.clone());
        if env.storage().persistent().has(&conf_key) {
            return Err(ContractError::AlreadyConfirmed);
        }

        let mut dep = load_deposit(&env, &deposit_id)?;
        match dep.status {
            DepositStatus::Pending | DepositStatus::Relayed => {}
            DepositStatus::Completed | DepositStatus::Refunded => {
                return Err(ContractError::InvalidDepositStatus);
            }
        }

        if dep.relay_confirmations > 0 {
            if dep.dest_tx_hash != tx_hash {
                return Err(ContractError::DestTxHashMismatch);
            }
        } else {
            dep.dest_tx_hash = tx_hash.clone();
        }

        env.storage().persistent().set(&conf_key, &true);

        dep.relay_confirmations = dep
            .relay_confirmations
            .checked_add(1)
            .ok_or(ContractError::InvalidDepositStatus)?;

        let mut rr = r;
        rr.total_relayed = rr
            .total_relayed
            .checked_add(1)
            .ok_or(ContractError::InvalidDepositStatus)?;
        env.storage()
            .persistent()
            .set(&DataKey::Relayer(relayer.clone()), &rr);

        if dep.relay_confirmations >= threshold {
            dep.status = DepositStatus::Completed;
        } else {
            dep.status = DepositStatus::Relayed;
        }
        save_deposit(&env, &deposit_id, &dep);

        let status_tag: u32 = match dep.status {
            DepositStatus::Pending => 0,
            DepositStatus::Relayed => 1,
            DepositStatus::Completed => 2,
            DepositStatus::Refunded => 3,
        };
        env.events().publish(
            (Symbol::new(&env, "bridge_confirm"), deposit_id.clone(), relayer.clone()),
            (tx_hash, dep.relay_confirmations, status_tag),
        );

        Ok(())
    }

    /// Depositor reclaims funds if relay is not completed within [`REFUND_TIMEOUT_SECS`].
    pub fn refund(env: Env, depositor: Address, deposit_id: DepositId) -> Result<(), ContractError> {
        depositor.require_auth();
        let mut dep = load_deposit(&env, &deposit_id)?;
        if dep.depositor != depositor {
            return Err(ContractError::NotDepositor);
        }
        match dep.status {
            DepositStatus::Pending | DepositStatus::Relayed => {}
            DepositStatus::Completed | DepositStatus::Refunded => {
                return Err(ContractError::InvalidDepositStatus);
            }
        }
        let now = env.ledger().timestamp();
        if now < dep.locked_at.saturating_add(REFUND_TIMEOUT_SECS) {
            return Err(ContractError::RefundTooEarly);
        }

        let hold = env.current_contract_address();
        let client = token::Client::new(&env, &dep.token);
        client.transfer(&hold, &dep.depositor, &dep.amount);

        dep.status = DepositStatus::Refunded;
        save_deposit(&env, &deposit_id, &dep);

        env.events().publish(
            (
                Symbol::new(&env, "bridge_refund"),
                deposit_id.clone(),
                depositor.clone(),
            ),
            (dep.token.clone(), dep.amount, now),
        );

        Ok(())
    }

    pub fn add_relayer(env: Env, admin: Address, relayer: Address) -> Result<(), ContractError> {
        require_admin(&env, &admin)?;
        let ts = env.ledger().timestamp();
        if let Some(mut existing) = env
            .storage()
            .persistent()
            .get(&DataKey::Relayer(relayer.clone()))
        {
            if existing.is_active {
                return Err(ContractError::RelayerAlreadyActive);
            }
            existing.is_active = true;
            existing.added_at = ts;
            env.storage()
                .persistent()
                .set(&DataKey::Relayer(relayer), &existing);
        } else {
            let rec = RelayerRecord {
                relayer: relayer.clone(),
                is_active: true,
                total_relayed: 0,
                added_at: ts,
            };
            env.storage()
                .persistent()
                .set(&DataKey::Relayer(relayer), &rec);
        }
        Ok(())
    }

    pub fn remove_relayer(env: Env, admin: Address, relayer: Address) -> Result<(), ContractError> {
        require_admin(&env, &admin)?;
        let mut rec = load_relayer(&env, &relayer)?;
        if !rec.is_active {
            return Err(ContractError::RelayerNotFound);
        }
        rec.is_active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Relayer(relayer), &rec);
        Ok(())
    }

    pub fn get_deposit(env: Env, deposit_id: DepositId) -> Option<BridgeDeposit> {
        env.storage()
            .persistent()
            .get(&DataKey::Deposit(deposit_id))
    }

    pub fn get_relayer(env: Env, relayer: Address) -> Option<RelayerRecord> {
        env.storage().persistent().get(&DataKey::Relayer(relayer))
    }
}

#[cfg(test)]
mod test;
