#![no_std]

use gasless_common::clients;
use gasless_common::migration;
use gasless_common::registry;
use gasless_common::types::{SharedAddress, TokenAmount};
use gasless_common::upgrade;
use gasless_common::{CommonError as ContractError, CROSS_CONTRACT_API_VERSION};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, BytesN, Env, String, Symbol, Vec,
};
use soroban_token_sdk::metadata::TokenMetadata;
use soroban_token_sdk::TokenUtils;

const MAX_NAME_LEN: u32 = 32;
const MAX_SYMBOL_LEN: u32 = 12;
const MIN_DECIMALS: u32 = 1;
const MAX_DECIMALS: u32 = 18;
const RATE_LIMIT_WINDOW_SECS: u64 = 1;

#[contracttype]
pub enum DataKey {
    Admin,
    Balance(SharedAddress),
    LastMintAt(SharedAddress),
    LastTransferAt(SharedAddress),
    ReentrancyLock,
}

fn get_admin(env: &Env) -> Result<SharedAddress, ContractError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(ContractError::NotInitialized)
}

fn get_balance(env: &Env, addr: &SharedAddress) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(addr.clone()))
        .unwrap_or(0)
}

fn set_balance(env: &Env, addr: &SharedAddress, amount: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::Balance(addr.clone()), &amount);
}

fn set_reentrancy_lock(env: &Env, locked: bool) {
    env.storage()
        .instance()
        .set(&DataKey::ReentrancyLock, &locked);
}

fn with_reentrancy_guard<F>(env: &Env, f: F) -> Result<(), ContractError>
where
    F: FnOnce() -> Result<(), ContractError>,
{
    let locked: bool = env
        .storage()
        .instance()
        .get(&DataKey::ReentrancyLock)
        .unwrap_or(false);
    if locked {
        return Err(ContractError::Reentrancy);
    }

    set_reentrancy_lock(env, true);
    let result = f();
    set_reentrancy_lock(env, false);
    result
}

fn ensure_rate_limit(env: &Env, key: DataKey) -> Result<(), ContractError> {
    let now = env.ledger().timestamp();
    let last: Option<u64> = env.storage().persistent().get(&key);
    if let Some(last_seen) = last {
        if now < last_seen.saturating_add(RATE_LIMIT_WINDOW_SECS) {
            return Err(ContractError::RateLimited);
        }
    }
    env.storage().persistent().set(&key, &now);
    Ok(())
}

fn validate_token_metadata(
    decimal: u32,
    name: &String,
    symbol: &String,
) -> Result<(), ContractError> {
    if !(MIN_DECIMALS..=MAX_DECIMALS).contains(&decimal) {
        return Err(ContractError::InvalidDecimals);
    }
    if name.is_empty() || name.len() > MAX_NAME_LEN {
        return Err(ContractError::InvalidName);
    }
    if symbol.is_empty() || symbol.len() > MAX_SYMBOL_LEN {
        return Err(ContractError::InvalidSymbol);
    }
    Ok(())
}

fn require_positive_amount(amount: i128) -> Result<(), ContractError> {
    TokenAmount::new(amount).map(|_| ())
}

#[contract]
pub struct WhsprToken;

#[contractimpl]
impl WhsprToken {
    pub fn version(_env: Env) -> u32 {
        CROSS_CONTRACT_API_VERSION
    }

    pub fn initialize(
        env: Env,
        admin: SharedAddress,
        decimal: u32,
        name: String,
        symbol: String,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        admin.require_auth();
        validate_token_metadata(decimal, &name, &symbol)?;

        env.storage().instance().set(&DataKey::Admin, &admin);
        set_reentrancy_lock(&env, false);

        TokenUtils::new(&env)
            .metadata()
            .set_metadata(&TokenMetadata {
                decimal,
                name,
                symbol,
            });
        Ok(())
    }

    pub fn mint(env: Env, to: SharedAddress, amount: i128) -> Result<(), ContractError> {
        require_positive_amount(amount)?;
        let admin = get_admin(&env)?;
        admin.require_auth();

        ensure_rate_limit(&env, DataKey::LastMintAt(admin.clone()))?;
        with_reentrancy_guard(&env, || {
            let balance = get_balance(&env, &to);
            let next_balance = balance.checked_add(amount).ok_or(ContractError::Overflow)?;
            set_balance(&env, &to, next_balance);

            TokenUtils::new(&env)
                .events()
                .mint(admin.clone(), to.clone(), amount);
            Ok(())
        })?;
        Ok(())
    }

    pub fn balance(env: Env, addr: SharedAddress) -> i128 {
        get_balance(&env, &addr)
    }

    pub fn transfer(
        env: Env,
        from: SharedAddress,
        to: SharedAddress,
        amount: i128,
    ) -> Result<(), ContractError> {
        require_positive_amount(amount)?;
        from.require_auth();
        ensure_rate_limit(&env, DataKey::LastTransferAt(from.clone()))?;
        with_reentrancy_guard(&env, || {
            let from_balance = get_balance(&env, &from);
            if from_balance < amount {
                return Err(ContractError::InsufficientBalance);
            }

            let next_from = from_balance
                .checked_sub(amount)
                .ok_or(ContractError::Underflow)?;
            set_balance(&env, &from, next_from);

            let to_balance = get_balance(&env, &to);
            let next_to = to_balance
                .checked_add(amount)
                .ok_or(ContractError::Overflow)?;
            set_balance(&env, &to, next_to);

            TokenUtils::new(&env)
                .events()
                .transfer(from.clone(), to.clone(), amount);
            Ok(())
        })?;
        Ok(())
    }

    pub fn set_contract_registry_entry(
        env: Env,
        contract_name: Symbol,
        address: SharedAddress,
        version: u32,
    ) -> Result<(), ContractError> {
        let admin = get_admin(&env)?;
        admin.require_auth();
        registry::set_contract(&env, contract_name, address, version);
        Ok(())
    }

    pub fn hello_from_registry(env: Env, to: Symbol) -> Result<Vec<Symbol>, ContractError> {
        clients::hello_via_registry(
            &env,
            symbol_short!("hello"),
            to,
            CROSS_CONTRACT_API_VERSION,
            CROSS_CONTRACT_API_VERSION,
        )
    }

    // ──────────────────────────────────────────────
    // Upgrade & Migration Functions
    // ──────────────────────────────────────────────

    pub fn init_upgrade(env: Env) -> Result<(), ContractError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let current_version = 1u32;
        // Use a placeholder wasm hash - in production this would be obtained from deployment
        let wasm_hash_bytes: BytesN<32> = BytesN::from_array(&env, &[0u8; 32]);

        upgrade::init_upgrade(&env, admin, current_version, wasm_hash_bytes)
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        // Validate multi-sig approval
        upgrade::require_multi_sig_signer(&env, &admin)?;

        // Pre-upgrade validation
        migration::validate_pre_upgrade(&env)?;

        // Get current state
        let current_version = upgrade::get_version(&env)?;
        let current_wasm_hash = upgrade::get_current_wasm_hash(&env)?;

        // Update wasm hash
        env.storage()
            .instance()
            .set(&upgrade::UpgradeKey::PreviousWasmHash, &current_wasm_hash);
        env.storage()
            .instance()
            .set(&upgrade::UpgradeKey::CurrentWasmHash, &new_wasm_hash);

        // Record upgrade
        upgrade::record_upgrade(&env, current_version, new_wasm_hash.clone(), admin.clone())?;

        // Emit upgrade event
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
        let admin = get_admin(&env)?;
        admin.require_auth();

        // Validate migration path
        upgrade::is_compatible_upgrade(from_version, to_version)?;

        // Pre-migration validation
        migration::validate_pre_upgrade(&env)?;

        // Execute migration (contract-specific logic would go here)
        // For token contract, state structure is stable, so minimal migration needed

        // Update version
        env.storage()
            .instance()
            .set(&upgrade::UpgradeKey::ContractVersion, &to_version);

        // Record migration
        upgrade::record_migration(&env, from_version, to_version, true)?;

        // Post-migration verification
        migration::verify_post_upgrade(&env)?;

        // Emit migration event
        env.events().publish(
            (symbol_short!("migrate"), admin.clone()),
            (from_version, to_version),
        );

        Ok(())
    }

    pub fn set_multi_sig(
        env: Env,
        signers: Vec<SharedAddress>,
        threshold: u32,
    ) -> Result<(), ContractError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        upgrade::set_multi_sig(&env, signers, threshold)
    }

    pub fn get_upgrade_info(env: Env) -> Result<(u32, BytesN<32>), ContractError> {
        let version = upgrade::get_version(&env)?;
        let wasm_hash = upgrade::get_current_wasm_hash(&env)?;
        Ok((version, wasm_hash))
    }

    pub fn verify_upgrade(env: Env) -> Result<bool, ContractError> {
        // Post-upgrade verification checks
        migration::verify_post_upgrade(&env)?;

        // Verify contract is still functional
        let admin = get_admin(&env)?;
        if admin.clone() == admin {
            Ok(true)
        } else {
            Err(ContractError::NotInitialized)
        }
    }
}

#[cfg(test)]
mod test;
