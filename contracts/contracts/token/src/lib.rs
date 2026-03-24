#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String};
use soroban_token_sdk::metadata::TokenMetadata;
use soroban_token_sdk::TokenUtils;

const MAX_NAME_LEN: u32 = 32;
const MAX_SYMBOL_LEN: u32 = 12;
const MIN_DECIMALS: u32 = 1;
const MAX_DECIMALS: u32 = 18;
const RATE_LIMIT_WINDOW_SECS: u64 = 1;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    InsufficientBalance = 5,
    Overflow = 6,
    Underflow = 7,
    InvalidDecimals = 8,
    InvalidName = 9,
    InvalidSymbol = 10,
    Reentrancy = 11,
    RateLimited = 12,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    LastMintAt(Address),
    LastTransferAt(Address),
    ReentrancyLock,
}

fn get_admin(env: &Env) -> Result<Address, ContractError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(ContractError::NotInitialized)
}

fn get_balance(env: &Env, addr: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(addr.clone()))
        .unwrap_or(0)
}

fn set_balance(env: &Env, addr: &Address, amount: i128) {
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
    if amount <= 0 {
        return Err(ContractError::InvalidAmount);
    }
    Ok(())
}

#[contract]
pub struct WhsprToken;

#[contractimpl]
impl WhsprToken {
    pub fn initialize(
        env: Env,
        admin: Address,
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

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), ContractError> {
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

    pub fn balance(env: Env, addr: Address) -> i128 {
        get_balance(&env, &addr)
    }

    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
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
}

#[cfg(test)]
mod test;
