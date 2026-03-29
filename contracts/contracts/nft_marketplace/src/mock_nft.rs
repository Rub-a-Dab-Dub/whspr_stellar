#![cfg(test)]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[derive(Clone)]
#[contracttype]
enum NftKey {
    Owner(u64),
}

#[contract]
pub struct MockNftContract;

#[contractimpl]
impl MockNftContract {
    pub fn mint(env: Env, to: Address, token_id: u64) {
        if env.storage().persistent().has(&NftKey::Owner(token_id)) {
            panic!("exists");
        }
        env.storage().persistent().set(&NftKey::Owner(token_id), &to);
    }

    /// Test mock: enforces owner match only. Production NFTs should use `from.require_auth()`;
    /// marketplace-as-`from` escrow returns do not carry end-user auth on this mock.
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u64) {
        let owner = Self::owner_of(env.clone(), token_id);
        if owner != from {
            panic!("not owner");
        }
        env.storage().persistent().set(&NftKey::Owner(token_id), &to);
    }

    pub fn owner_of(env: Env, token_id: u64) -> Address {
        env.storage()
            .persistent()
            .get(&NftKey::Owner(token_id))
            .expect("no token")
    }
}
