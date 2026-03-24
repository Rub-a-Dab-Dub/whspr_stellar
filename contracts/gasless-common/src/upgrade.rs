use crate::CommonError;
use soroban_sdk::{contracttype, Address, BytesN, Env, Vec};

/// Current contract version for upgrade tracking
pub const UPGRADE_VERSION: u32 = 1;

/// Represents a contract upgrade state snapshot
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeSnapshot {
    pub version: u32,
    pub wasm_hash: BytesN<32>,
    pub timestamp: u64,
    pub admin: Address,
}

/// Represents a state migration record
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MigrationRecord {
    pub from_version: u32,
    pub to_version: u32,
    pub timestamp: u64,
    pub success: bool,
}

/// Storage keys for upgrade tracking
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum UpgradeKey {
    /// Current contract version
    ContractVersion,
    /// Current wasm hash
    CurrentWasmHash,
    /// Previous wasm hash for rollback
    PreviousWasmHash,
    /// Upgrade snapshot history
    UpgradeHistory(u32),
    /// Migration history
    MigrationHistory(u32),
    /// Upgrade counter
    UpgradeCount,
    /// Migration counter
    MigrationCount,
    /// Multi-sig approval signers
    MultiSigSigners,
    /// Multi-sig approval threshold
    MultiSigThreshold,
    /// Pending upgrade approval votes
    UpgradeApprovalVotes(BytesN<32>),
    /// Pending upgrade wasm hash
    PendingUpgradeHash,
}

/// Initializes upgrade infrastructure for a contract
pub fn init_upgrade(
    env: &Env,
    admin: Address,
    initial_version: u32,
    initial_wasm_hash: BytesN<32>,
) -> Result<(), CommonError> {
    // Check if already initialized
    if env.storage().instance().has(&UpgradeKey::ContractVersion) {
        return Err(CommonError::AlreadyInitialized);
    }

    env.storage()
        .instance()
        .set(&UpgradeKey::ContractVersion, &initial_version);
    env.storage()
        .instance()
        .set(&UpgradeKey::CurrentWasmHash, &initial_wasm_hash);
    env.storage()
        .instance()
        .set(&UpgradeKey::UpgradeCount, &0u32);
    env.storage()
        .instance()
        .set(&UpgradeKey::MigrationCount, &0u32);

    // Initialize multi-sig with admin as sole signer
    let mut signers: Vec<Address> = Vec::new(env);
    signers.push_back(admin);
    env.storage()
        .instance()
        .set(&UpgradeKey::MultiSigSigners, &signers);
    env.storage()
        .instance()
        .set(&UpgradeKey::MultiSigThreshold, &1u32);

    Ok(())
}

/// Gets the current contract version
pub fn get_version(env: &Env) -> Result<u32, CommonError> {
    env.storage()
        .instance()
        .get(&UpgradeKey::ContractVersion)
        .ok_or(CommonError::NotInitialized)
}

/// Gets the current wasm hash
pub fn get_current_wasm_hash(env: &Env) -> Result<BytesN<32>, CommonError> {
    env.storage()
        .instance()
        .get(&UpgradeKey::CurrentWasmHash)
        .ok_or(CommonError::NotInitialized)
}

/// Gets the previous wasm hash for rollback
pub fn get_previous_wasm_hash(env: &Env) -> Result<BytesN<32>, CommonError> {
    env.storage()
        .instance()
        .get(&UpgradeKey::PreviousWasmHash)
        .ok_or(CommonError::NotInitialized)
}

/// Records an upgrade in history
pub fn record_upgrade(
    env: &Env,
    version: u32,
    wasm_hash: BytesN<32>,
    admin: Address,
) -> Result<(), CommonError> {
    let count: u32 = env
        .storage()
        .instance()
        .get(&UpgradeKey::UpgradeCount)
        .unwrap_or(0);

    let snapshot = UpgradeSnapshot {
        version,
        wasm_hash,
        timestamp: env.ledger().timestamp(),
        admin,
    };

    env.storage()
        .instance()
        .set(&UpgradeKey::UpgradeHistory(count), &snapshot);
    env.storage()
        .instance()
        .set(&UpgradeKey::UpgradeCount, &(count + 1));

    Ok(())
}

/// Records a state migration in history
pub fn record_migration(
    env: &Env,
    from_version: u32,
    to_version: u32,
    success: bool,
) -> Result<(), CommonError> {
    let count: u32 = env
        .storage()
        .instance()
        .get(&UpgradeKey::MigrationCount)
        .unwrap_or(0);

    let record = MigrationRecord {
        from_version,
        to_version,
        timestamp: env.ledger().timestamp(),
        success,
    };

    env.storage()
        .instance()
        .set(&UpgradeKey::MigrationHistory(count), &record);
    env.storage()
        .instance()
        .set(&UpgradeKey::MigrationCount, &(count + 1));

    Ok(())
}

/// Sets multi-sig signers and threshold
pub fn set_multi_sig(env: &Env, signers: Vec<Address>, threshold: u32) -> Result<(), CommonError> {
    if signers.is_empty() {
        return Err(CommonError::InvalidInput);
    }
    if threshold == 0 || threshold > signers.len() {
        return Err(CommonError::InvalidInput);
    }

    env.storage()
        .instance()
        .set(&UpgradeKey::MultiSigSigners, &signers);
    env.storage()
        .instance()
        .set(&UpgradeKey::MultiSigThreshold, &threshold);

    Ok(())
}

/// Gets multi-sig signers
pub fn get_multi_sig_signers(env: &Env) -> Result<Vec<Address>, CommonError> {
    env.storage()
        .instance()
        .get(&UpgradeKey::MultiSigSigners)
        .ok_or(CommonError::NotInitialized)
}

/// Gets multi-sig threshold
pub fn get_multi_sig_threshold(env: &Env) -> Result<u32, CommonError> {
    env.storage()
        .instance()
        .get(&UpgradeKey::MultiSigThreshold)
        .ok_or(CommonError::NotInitialized)
}

/// Validates that caller is a multi-sig signer
pub fn require_multi_sig_signer(env: &Env, caller: &Address) -> Result<(), CommonError> {
    let signers = get_multi_sig_signers(env)?;
    if !signers.contains(caller) {
        return Err(CommonError::Unauthorized);
    }
    Ok(())
}

/// Checks if upgrade is compatible (version can be migrated)
pub fn is_compatible_upgrade(from_version: u32, to_version: u32) -> Result<(), CommonError> {
    // Allow upgrades within reasonable version range (e.g., v1 to v10)
    if to_version <= from_version {
        return Err(CommonError::VersionMismatch);
    }
    if to_version > from_version + 10 {
        return Err(CommonError::VersionMismatch);
    }
    Ok(())
}
