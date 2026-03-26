#![no_std]

use gasless_common::access_control;
use gasless_common::migration;
use gasless_common::upgrade;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env,
    Symbol, Vec,
};

const DEFAULT_TX_TTL_LEDGERS: u32 = 200;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MultisigWallet {
    pub wallet_id: BytesN<32>,
    pub signers: Vec<Address>,
    pub threshold: u32,
    pub next_tx_nonce: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PendingTx {
    pub tx_id: BytesN<32>,
    pub wallet_id: BytesN<32>,
    pub to: Address,
    pub amount: i128,
    pub data: Bytes,
    pub created_ledger: u32,
    pub expires_ledger: u32,
    pub signature_count: u32,
    pub executed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct SignatureRecord {
    pub tx_id: BytesN<32>,
    pub signer: Address,
    pub signed_ledger: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Wallet(BytesN<32>),
    PendingTx(BytesN<32>),
    Signature(BytesN<32>, Address),
    Admin,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    InvalidThreshold = 1,
    InvalidSigners = 2,
    WalletNotFound = 3,
    TxNotFound = 4,
    NotASigner = 5,
    AlreadySigned = 6,
    NotSigned = 7,
    TxExpired = 8,
    TxAlreadyExecuted = 9,
    ThresholdNotMet = 10,
    InvalidAmount = 11,
    DuplicateSigner = 12,
}

#[contract]
pub struct MultisigWalletContract;

#[contractimpl]
impl MultisigWalletContract {
    /// Create a new multisig wallet with specified signers and threshold
    pub fn create_wallet(
        env: Env,
        signers: Vec<Address>,
        threshold: u32,
    ) -> Result<BytesN<32>, ContractError> {
        if signers.is_empty() {
            return Err(ContractError::InvalidSigners);
        }

        if threshold == 0 || threshold > signers.len() {
            return Err(ContractError::InvalidThreshold);
        }

        // Check for duplicate signers
        for i in 0..signers.len() {
            for j in (i + 1)..signers.len() {
                if signers.get(i).unwrap() == signers.get(j).unwrap() {
                    return Err(ContractError::DuplicateSigner);
                }
            }
        }

        let wallet_id = Self::build_wallet_id(&env, &signers, threshold);

        let wallet = MultisigWallet {
            wallet_id: wallet_id.clone(),
            signers: signers.clone(),
            threshold,
            next_tx_nonce: 1,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Wallet(wallet_id.clone()), &wallet);

        env.events().publish(
            (Symbol::new(&env, "wallet_created"), wallet_id.clone()),
            (signers, threshold, env.ledger().timestamp()),
        );

        Ok(wallet_id)
    }

    /// Propose a new transaction
    pub fn propose_transaction(
        env: Env,
        wallet_id: BytesN<32>,
        to: Address,
        amount: i128,
        data: Bytes,
        proposer: Address,
    ) -> Result<BytesN<32>, ContractError> {
        proposer.require_auth();

        if amount < 0 {
            return Err(ContractError::InvalidAmount);
        }

        let mut wallet = Self::get_wallet(&env, wallet_id.clone())?;

        // Verify proposer is a signer
        if !Self::is_signer(&wallet, &proposer) {
            return Err(ContractError::NotASigner);
        }

        let tx_id = Self::build_tx_id(&env, &wallet_id, wallet.next_tx_nonce);
        wallet.next_tx_nonce = wallet
            .next_tx_nonce
            .checked_add(1)
            .ok_or(ContractError::InvalidAmount)?;

        let created_ledger = env.ledger().sequence();
        let expires_ledger = created_ledger.saturating_add(DEFAULT_TX_TTL_LEDGERS);

        let pending_tx = PendingTx {
            tx_id: tx_id.clone(),
            wallet_id: wallet_id.clone(),
            to: to.clone(),
            amount,
            data: data.clone(),
            created_ledger,
            expires_ledger,
            signature_count: 0,
            executed: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Wallet(wallet_id.clone()), &wallet);
        env.storage()
            .persistent()
            .set(&DataKey::PendingTx(tx_id.clone()), &pending_tx);

        env.events().publish(
            (Symbol::new(&env, "tx_proposed"), tx_id.clone()),
            (
                wallet_id,
                to,
                amount,
                proposer,
                expires_ledger,
                env.ledger().timestamp(),
            ),
        );

        Ok(tx_id)
    }

    /// Sign a pending transaction
    pub fn sign_transaction(
        env: Env,
        tx_id: BytesN<32>,
        signer: Address,
    ) -> Result<(), ContractError> {
        signer.require_auth();

        let mut pending_tx = Self::get_pending_tx(&env, tx_id.clone())?;

        if pending_tx.executed {
            return Err(ContractError::TxAlreadyExecuted);
        }

        if Self::is_expired(&env, &pending_tx) {
            return Err(ContractError::TxExpired);
        }

        let wallet = Self::get_wallet(&env, pending_tx.wallet_id.clone())?;

        // Verify signer is authorized
        if !Self::is_signer(&wallet, &signer) {
            return Err(ContractError::NotASigner);
        }

        // Check if already signed
        if env
            .storage()
            .persistent()
            .has(&DataKey::Signature(tx_id.clone(), signer.clone()))
        {
            return Err(ContractError::AlreadySigned);
        }

        let signature = SignatureRecord {
            tx_id: tx_id.clone(),
            signer: signer.clone(),
            signed_ledger: env.ledger().sequence(),
        };

        pending_tx.signature_count = pending_tx.signature_count.saturating_add(1);

        env.storage().persistent().set(
            &DataKey::Signature(tx_id.clone(), signer.clone()),
            &signature,
        );
        env.storage()
            .persistent()
            .set(&DataKey::PendingTx(tx_id.clone()), &pending_tx);

        env.events().publish(
            (Symbol::new(&env, "tx_signed"), tx_id.clone()),
            (
                signer,
                pending_tx.signature_count,
                wallet.threshold,
                env.ledger().timestamp(),
            ),
        );

        Ok(())
    }

    /// Revoke a signature from a pending transaction
    pub fn revoke_signature(
        env: Env,
        tx_id: BytesN<32>,
        signer: Address,
    ) -> Result<(), ContractError> {
        signer.require_auth();

        let mut pending_tx = Self::get_pending_tx(&env, tx_id.clone())?;

        if pending_tx.executed {
            return Err(ContractError::TxAlreadyExecuted);
        }

        if Self::is_expired(&env, &pending_tx) {
            return Err(ContractError::TxExpired);
        }

        let wallet = Self::get_wallet(&env, pending_tx.wallet_id.clone())?;

        // Verify signer is authorized
        if !Self::is_signer(&wallet, &signer) {
            return Err(ContractError::NotASigner);
        }

        // Check if signature exists
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Signature(tx_id.clone(), signer.clone()))
        {
            return Err(ContractError::NotSigned);
        }

        env.storage()
            .persistent()
            .remove(&DataKey::Signature(tx_id.clone(), signer.clone()));

        pending_tx.signature_count = pending_tx.signature_count.saturating_sub(1);

        env.storage()
            .persistent()
            .set(&DataKey::PendingTx(tx_id.clone()), &pending_tx);

        env.events().publish(
            (Symbol::new(&env, "sig_revoked"), tx_id.clone()),
            (
                signer,
                pending_tx.signature_count,
                wallet.threshold,
                env.ledger().timestamp(),
            ),
        );

        Ok(())
    }

    /// Execute a transaction once threshold is met
    pub fn execute_transaction(
        env: Env,
        tx_id: BytesN<32>,
        executor: Address,
    ) -> Result<(), ContractError> {
        executor.require_auth();

        let mut pending_tx = Self::get_pending_tx(&env, tx_id.clone())?;

        if pending_tx.executed {
            return Err(ContractError::TxAlreadyExecuted);
        }

        if Self::is_expired(&env, &pending_tx) {
            return Err(ContractError::TxExpired);
        }

        let wallet = Self::get_wallet(&env, pending_tx.wallet_id.clone())?;

        // Verify executor is a signer
        if !Self::is_signer(&wallet, &executor) {
            return Err(ContractError::NotASigner);
        }

        // Check threshold
        if pending_tx.signature_count < wallet.threshold {
            return Err(ContractError::ThresholdNotMet);
        }

        pending_tx.executed = true;

        env.storage()
            .persistent()
            .set(&DataKey::PendingTx(tx_id.clone()), &pending_tx);

        env.events().publish(
            (Symbol::new(&env, "tx_executed"), tx_id.clone()),
            (
                pending_tx.wallet_id,
                pending_tx.to,
                pending_tx.amount,
                executor,
                env.ledger().timestamp(),
            ),
        );

        Ok(())
    }

    /// Add a new signer to the wallet (requires existing quorum)
    pub fn add_signer(
        env: Env,
        wallet_id: BytesN<32>,
        new_signer: Address,
        approvers: Vec<Address>,
    ) -> Result<(), ContractError> {
        let mut wallet = Self::get_wallet(&env, wallet_id.clone())?;

        // Verify quorum of existing signers
        if approvers.len() < wallet.threshold {
            return Err(ContractError::ThresholdNotMet);
        }

        for i in 0..approvers.len() {
            let approver = approvers.get(i).unwrap();
            approver.require_auth();

            if !Self::is_signer(&wallet, &approver) {
                return Err(ContractError::NotASigner);
            }
        }

        // Check if already a signer
        if Self::is_signer(&wallet, &new_signer) {
            return Err(ContractError::DuplicateSigner);
        }

        wallet.signers.push_back(new_signer.clone());

        env.storage()
            .persistent()
            .set(&DataKey::Wallet(wallet_id.clone()), &wallet);

        env.events().publish(
            (Symbol::new(&env, "signer_added"), wallet_id),
            (new_signer, wallet.signers.len(), env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Remove a signer from the wallet (requires existing quorum)
    pub fn remove_signer(
        env: Env,
        wallet_id: BytesN<32>,
        signer_to_remove: Address,
        approvers: Vec<Address>,
    ) -> Result<(), ContractError> {
        let mut wallet = Self::get_wallet(&env, wallet_id.clone())?;

        // Verify quorum of existing signers
        if approvers.len() < wallet.threshold {
            return Err(ContractError::ThresholdNotMet);
        }

        for i in 0..approvers.len() {
            let approver = approvers.get(i).unwrap();
            approver.require_auth();

            if !Self::is_signer(&wallet, &approver) {
                return Err(ContractError::NotASigner);
            }
        }

        // Find and remove signer
        let mut found = false;
        let mut new_signers = Vec::new(&env);

        for i in 0..wallet.signers.len() {
            let signer = wallet.signers.get(i).unwrap();
            if signer == signer_to_remove {
                found = true;
            } else {
                new_signers.push_back(signer);
            }
        }

        if !found {
            return Err(ContractError::NotASigner);
        }

        // Ensure threshold is still valid
        if wallet.threshold > new_signers.len() {
            return Err(ContractError::InvalidThreshold);
        }

        wallet.signers = new_signers;

        env.storage()
            .persistent()
            .set(&DataKey::Wallet(wallet_id.clone()), &wallet);

        env.events().publish(
            (Symbol::new(&env, "signer_removed"), wallet_id),
            (
                signer_to_remove,
                wallet.signers.len(),
                env.ledger().timestamp(),
            ),
        );

        Ok(())
    }

    /// Update the threshold (requires existing quorum)
    pub fn update_threshold(
        env: Env,
        wallet_id: BytesN<32>,
        new_threshold: u32,
        approvers: Vec<Address>,
    ) -> Result<(), ContractError> {
        let mut wallet = Self::get_wallet(&env, wallet_id.clone())?;

        // Verify quorum of existing signers
        if approvers.len() < wallet.threshold {
            return Err(ContractError::ThresholdNotMet);
        }

        for i in 0..approvers.len() {
            let approver = approvers.get(i).unwrap();
            approver.require_auth();

            if !Self::is_signer(&wallet, &approver) {
                return Err(ContractError::NotASigner);
            }
        }

        if new_threshold == 0 || new_threshold > wallet.signers.len() {
            return Err(ContractError::InvalidThreshold);
        }

        let old_threshold = wallet.threshold;
        wallet.threshold = new_threshold;

        env.storage()
            .persistent()
            .set(&DataKey::Wallet(wallet_id.clone()), &wallet);

        env.events().publish(
            (Symbol::new(&env, "threshold_updated"), wallet_id),
            (old_threshold, new_threshold, env.ledger().timestamp()),
        );

        Ok(())
    }

    // ──────────────────────────────────────────────
    // View Functions
    // ──────────────────────────────────────────────

    pub fn get_wallet(env: &Env, wallet_id: BytesN<32>) -> Result<MultisigWallet, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Wallet(wallet_id))
            .ok_or(ContractError::WalletNotFound)
    }

    pub fn get_pending_tx(env: &Env, tx_id: BytesN<32>) -> Result<PendingTx, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::PendingTx(tx_id))
            .ok_or(ContractError::TxNotFound)
    }

    pub fn has_signed(env: Env, tx_id: BytesN<32>, signer: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Signature(tx_id, signer))
    }

    pub fn get_signature(
        env: Env,
        tx_id: BytesN<32>,
        signer: Address,
    ) -> Result<SignatureRecord, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Signature(tx_id, signer))
            .ok_or(ContractError::NotSigned)
    }

    // ──────────────────────────────────────────────
    // Helper Functions
    // ──────────────────────────────────────────────

    fn is_signer(wallet: &MultisigWallet, address: &Address) -> bool {
        for i in 0..wallet.signers.len() {
            if wallet.signers.get(i).unwrap() == *address {
                return true;
            }
        }
        false
    }

    fn build_wallet_id(env: &Env, signers: &Vec<Address>, threshold: u32) -> BytesN<32> {
        let mut seed = Bytes::new(env);
        for i in 0..signers.len() {
            let addr = signers.get(i).unwrap();
            seed.append(&Bytes::from_array(
                env,
                &addr.to_string().len().to_be_bytes(),
            ));
        }
        seed.append(&Bytes::from_array(env, &threshold.to_be_bytes()));
        seed.append(&Bytes::from_array(
            env,
            &env.ledger().timestamp().to_be_bytes(),
        ));
        env.crypto().sha256(&seed).into()
    }

    fn build_tx_id(env: &Env, wallet_id: &BytesN<32>, nonce: u64) -> BytesN<32> {
        let mut seed = Bytes::new(env);
        seed.append(&Bytes::from_array(env, &wallet_id.to_array()));
        seed.append(&Bytes::from_array(env, &nonce.to_be_bytes()));
        env.crypto().sha256(&seed).into()
    }

    fn is_expired(env: &Env, tx: &PendingTx) -> bool {
        env.ledger().sequence() > tx.expires_ledger
    }

    // ──────────────────────────────────────────────
    // Upgrade & Migration Functions
    // ──────────────────────────────────────────────

    pub fn init(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::InvalidThreshold);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);

        access_control::init_access_control(&env, admin.clone())
            .map_err(|_| ContractError::InvalidThreshold)?;

        let wasm_hash_bytes: BytesN<32> = BytesN::from_array(&env, &[0u8; 32]);
        upgrade::init_upgrade(&env, admin, 1u32, wasm_hash_bytes)
            .map_err(|_| ContractError::InvalidThreshold)
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::InvalidThreshold)?;
        admin.require_auth();

        upgrade::require_multi_sig_signer(&env, &admin)
            .map_err(|_| ContractError::InvalidThreshold)?;

        migration::validate_pre_upgrade(&env).map_err(|_| ContractError::InvalidThreshold)?;

        let current_version =
            upgrade::get_version(&env).map_err(|_| ContractError::InvalidThreshold)?;
        let current_wasm_hash =
            upgrade::get_current_wasm_hash(&env).map_err(|_| ContractError::InvalidThreshold)?;

        env.storage()
            .instance()
            .set(&upgrade::UpgradeKey::PreviousWasmHash, &current_wasm_hash);
        env.storage()
            .instance()
            .set(&upgrade::UpgradeKey::CurrentWasmHash, &new_wasm_hash);

        upgrade::record_upgrade(&env, current_version, new_wasm_hash.clone(), admin.clone())
            .map_err(|_| ContractError::InvalidThreshold)?;

        env.events().publish(
            (symbol_short!("upgrade"), admin.clone()),
            (current_version, new_wasm_hash),
        );

        Ok(())
    }

    pub fn migrate_state(
        env: Env,
        from_version: u32,
        to_version: u32,
    ) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::InvalidThreshold)?;
        admin.require_auth();

        upgrade::is_compatible_upgrade(from_version, to_version)
            .map_err(|_| ContractError::InvalidThreshold)?;

        migration::validate_pre_upgrade(&env).map_err(|_| ContractError::InvalidThreshold)?;

        env.storage()
            .instance()
            .set(&upgrade::UpgradeKey::ContractVersion, &to_version);

        upgrade::record_migration(&env, from_version, to_version, true)
            .map_err(|_| ContractError::InvalidThreshold)?;

        migration::verify_post_upgrade(&env).map_err(|_| ContractError::InvalidThreshold)?;

        env.events().publish(
            (symbol_short!("migrate"), admin.clone()),
            (from_version, to_version),
        );

        Ok(())
    }

    pub fn verify_upgrade(env: Env) -> Result<bool, ContractError> {
        migration::verify_post_upgrade(&env).map_err(|_| ContractError::InvalidThreshold)?;
        Ok(true)
    }

    // ──────────────────────────────────────────────
    // Access Control Functions
    // ──────────────────────────────────────────────

    pub fn grant_role(
        env: Env,
        role: Symbol,
        address: Address,
        caller: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        access_control::grant_role(&env, role, address, caller)
            .map_err(|_| ContractError::InvalidThreshold)
    }

    pub fn revoke_role(
        env: Env,
        role: Symbol,
        address: Address,
        caller: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        access_control::revoke_role(&env, role, address, caller)
            .map_err(|_| ContractError::InvalidThreshold)
    }

    pub fn has_role(env: Env, role: Symbol, address: Address) -> bool {
        access_control::has_role(&env, role, address)
    }
}

#[cfg(test)]
mod test;
