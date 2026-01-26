#![no_std]

use soroban_sdk::{Address, Env, Symbol, contract, contracterror, contractimpl, contracttype};

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    UserAlreadyRegistered = 4,
    UserNotFound = 5,
    UsernameTaken = 6,
    InvalidUsername = 7,
}

#[contract]
pub struct BaseContract;

/// Storage keys
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Metadata,
    User(Address),
    Username(Symbol),
}

/// Simple metadata structure
#[derive(Clone)]
#[contracttype]
pub struct ContractMetadata {
    pub name: Symbol,
    pub version: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct UserProfile {
    pub address: Address,
    pub username: Symbol,
    pub xp: u64,
    pub level: u32,
    pub badges: Vec<Symbol>,
    pub join_date: u64,
}

#[contractimpl]
impl BaseContract {
    pub fn init(env: Env, admin: Address, name: Symbol, version: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        admin.require_auth();

        let metadata = ContractMetadata { name, version };

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Metadata, &metadata);
    }

    pub fn admin(env: Env) -> Result<UserProfile, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn get_user_profile(env: Env, user: Address) -> Result<UserProfile, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::User(user))
            .ok_or(ContractError::UserNotFound)
    }

    pub fn register_user(env: Env, username: Symbol) -> Result<(), ContractError> {
        let caller = env.invoker();
        caller.require_auth();

        validate_username(&username)?;

        if env.storage().instance().has(&DataKey::User(caller.clone())) {
            return Err(ContractError::UserAlreadyRegistered);
        }

        if env
            .storage()
            .instance()
            .has(&DataKey::Username(username.clone()))
        {
            return Err(ContractError::UsernameTaken);
        }

        let profile = UserProfile {
            address: caller.clone(),
            username: username.clone(),
            xp: 0,
            level: 1,
            badges: Vec::new(&env),
            join_date: env.ledger().timestamp(),
        };

        env.storage()
            .instance()
            .set(&DataKey::User(caller.clone()), &profile);

        env.storage()
            .instance()
            .set(&DataKey::Username(username), &caller);

        Ok(())
    }

    pub fn get_user_profile(env: Env, user: Address) -> UserProfile {
        env.storage()
            .instance()
            .get(&DataKey::User(user))
            .expect("user not found")
    }

    pub fn update_username(env: Env, new_username: Symbol) -> Result<(), ContractError> {
        let caller = env.invoker();
        caller.require_auth();

        validate_username(&new_username)?;

        if env
            .storage()
            .instance()
            .has(&DataKey::Username(new_username.clone()))
        {
            return Err(ContractError::UsernameTaken);
        }

        let mut profile: UserProfile = env
            .storage()
            .instance()
            .get(&DataKey::User(caller.clone()))
            .ok_or(ContractError::UserNotFound)?;

        env.storage()
            .instance()
            .remove(&DataKey::Username(profile.username.clone()));

        env.storage()
            .instance()
            .set(&DataKey::Username(new_username.clone()), &caller);

        profile.username = new_username;

        env.storage()
            .instance()
            .set(&DataKey::User(caller), &profile);

        Ok(())
    }

    pub fn add_xp(env: Env, user: Address, xp_amount: u64) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;

        admin.require_auth();

        let mut profile: UserProfile = env
            .storage()
            .instance()
            .get(&DataKey::User(user.clone()))
            .ok_or(ContractError::UserNotFound)?;

        profile.xp += xp_amount;
        profile.level = calculate_level(profile.xp);

        env.storage().instance().set(&DataKey::User(user), &profile);

        Ok(())
    }
}

fn validate_username(username: &Symbol) {
    let len = username.len();
    if len < 3 || len > 16 {
        return Err(ContractError::InvalidUsername);
    }
}

// subject to change base on xp point design
fn calculate_level(xp: u64) -> u32 {
    match xp {
        0..=99 => 1,
        100..=299 => 2,
        300..=599 => 3,
        600..=999 => 4,
        _ => 5,
    }
}
