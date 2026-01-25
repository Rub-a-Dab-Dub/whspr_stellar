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
}

/// Simple metadata structure
#[derive(Clone)]
#[contracttype]
pub struct ContractMetadata {
    pub name: Symbol,
    pub version: u32,
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
}

