#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Bytes, Env};

/// Platform fee in basis points (200 = 2%)
const FEE_BPS: i128 = 200;
const BPS_DENOM: i128 = 10_000;

#[contracttype]
pub enum DataKey {
    Platform,
}

#[contract]
pub struct PaymentsContract;

#[contractimpl]
impl PaymentsContract {
    /// Initialize with a platform fee recipient address.
    pub fn initialize(env: Env, platform: Address) {
        if env.storage().instance().has(&DataKey::Platform) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Platform, &platform);
    }

    /// Tip a user in a room. 2% goes to platform, 98% to recipient.
    /// Returns XP awarded to sender (20).
    pub fn tip(
        env: Env,
        from: Address,
        to: Address,
        token_id: Address,
        amount: i128,
        room_id: Bytes,
    ) -> i128 {
        from.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }
        if from == to {
            panic!("cannot tip self");
        }

        let platform: Address = env
            .storage()
            .instance()
            .get(&DataKey::Platform)
            .expect("not initialized");

        let fee = amount * FEE_BPS / BPS_DENOM;
        let net = amount - fee;

        let client = token::Client::new(&env, &token_id);
        client.transfer(&from, &to, &net);
        if fee > 0 {
            client.transfer(&from, &platform, &fee);
        }

        env.events().publish(
            (symbol_short!("tip_sent"), from.clone(), to.clone()),
            (amount, fee, room_id),
        );

        20 // XP
    }

    /// P2P transfer with no platform fee.
    pub fn transfer(env: Env, from: Address, to: Address, token_id: Address, amount: i128) {
        from.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }
        if from == to {
            panic!("cannot transfer to self");
        }

        let client = token::Client::new(&env, &token_id);
        client.transfer(&from, &to, &amount);

        env.events()
            .publish((symbol_short!("xfer_sent"), from, to), (amount, token_id));
    }
}

#[cfg(test)]
mod tests;
