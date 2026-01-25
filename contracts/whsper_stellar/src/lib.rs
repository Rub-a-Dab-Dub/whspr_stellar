#![no_std]

use soroban_sdk::{
    contract,
    contractimpl,
    contracttype,
    Address,
    Env,
    Symbol,
};

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
            panic!("contract already initialized");
        }

        admin.require_auth();

        let metadata = ContractMetadata { name, version };

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Metadata, &metadata);
    }

    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized")
    }

    pub fn metadata(env: Env) -> ContractMetadata {
        env.storage()
            .instance()
            .get(&DataKey::Metadata)
            .expect("not initialized")
    }

     pub fn register_user(env: Env, username: Symbol) {
        let caller = env.invoker();
        caller.require_auth();

        // validate username length
        validate_username(&username);

        if env.storage().instance().has(&DataKey::User(caller.clone())) {
            panic!("user already registered"); // use custom error 
        }

         if env.storage().instance().has(&DataKey::Username(username.clone())) {
            panic!("username already taken");
        }

        let join_date = env.ledger().timestamp();
        
        let profile = UserProfile {
            address: caller.clone(),
            username: username.clone(),
            xp: 0,
            level: 1,
            badges: Vec::new(&env),
            join_date,
        };

        env.storage()
            .instance()
            .set(&DataKey::User(caller.clone()), &profile);

        env.storage()
            .instance()
            .set(&DataKey::Username(username), &caller);

     }

    pub fn get_user_profile(env: Env, user: Address) -> UserProfile {
    env.storage()
        .instance()
        .get(&DataKey::User(user))
        .expect("user not found")
    }

}


fn validate_username(username: &Symbol) {
    let len = username.len();
    if len < 3 || len > 16 {
        panic!("invalid username length");
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
