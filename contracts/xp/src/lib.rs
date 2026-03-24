#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

const XP_PER_LEVEL: i128 = 1_000;

#[contracttype]
pub enum DataKey {
    Xp(Address),
    Admin,
}

#[contract]
pub struct XpContract;

#[contractimpl]
impl XpContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Award XP to a user. Only callable by admin (the backend/paymaster).
    /// Returns new level if a level-up occurred, else 0.
    pub fn award_xp(env: Env, user: Address, amount: i128, reason: Symbol) -> u32 {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let key = DataKey::Xp(user.clone());
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_total = prev + amount;
        env.storage().persistent().set(&key, &new_total);

        env.events().publish(
            (symbol_short!("xp_award"), user.clone()),
            (amount, reason, new_total),
        );

        let prev_level = (prev / XP_PER_LEVEL) as u32;
        let new_level = (new_total / XP_PER_LEVEL) as u32;

        if new_level > prev_level {
            env.events()
                .publish((symbol_short!("lvl_up"), user), (new_level, new_total));
            return new_level;
        }

        0
    }

    pub fn get_xp(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Xp(user))
            .unwrap_or(0)
    }

    pub fn get_level(env: Env, user: Address) -> u32 {
        let xp: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Xp(user))
            .unwrap_or(0);
        (xp / XP_PER_LEVEL) as u32
    }
}

#[cfg(test)]
mod tests;
