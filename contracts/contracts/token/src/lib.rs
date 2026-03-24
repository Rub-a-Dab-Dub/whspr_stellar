#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};
use soroban_token_sdk::metadata::TokenMetadata;
use soroban_token_sdk::TokenUtils;

#[contracttype]
pub enum DataKey {
    Admin,
    Allowance(Address, Address),
    Balance(Address),
}

fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("admin not set")
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

#[contract]
pub struct WhsprToken;

#[contractimpl]
impl WhsprToken {
    pub fn initialize(env: Env, admin: Address, decimal: u32, name: String, symbol: String) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);

        TokenUtils::new(&env)
            .metadata()
            .set_metadata(&TokenMetadata {
                decimal,
                name,
                symbol,
            });
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin = get_admin(&env);
        admin.require_auth();

        let balance = get_balance(&env, &to);
        set_balance(&env, &to, balance + amount);

        TokenUtils::new(&env).events().mint(admin, to, amount);
    }

    pub fn balance(env: Env, addr: Address) -> i128 {
        get_balance(&env, &addr)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        let from_balance = get_balance(&env, &from);
        assert!(from_balance >= amount, "insufficient balance");

        set_balance(&env, &from, from_balance - amount);
        let to_balance = get_balance(&env, &to);
        set_balance(&env, &to, to_balance + amount);

        TokenUtils::new(&env).events().transfer(from, to, amount);
    }
}

#[cfg(test)]
mod test;
