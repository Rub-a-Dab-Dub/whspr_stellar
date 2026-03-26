use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol};

use crate::types::UserTier;

// ── Storage key enum ──────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    FeeConfig,
    FeeBalance,
    UserTier(Address),
    WaivedOperation(Symbol),
}

// ── Admin ─────────────────────────────────────────────────────────────────────

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

// ── Fee config ────────────────────────────────────────────────────────────────

pub fn get_fee_config(env: &Env) -> Option<crate::types::FeeConfig> {
    env.storage().instance().get(&DataKey::FeeConfig)
}

pub fn set_fee_config(env: &Env, config: &crate::types::FeeConfig) {
    env.storage().instance().set(&DataKey::FeeConfig, config);
}

// ── Fee balance ───────────────────────────────────────────────────────────────

pub fn get_fee_balance(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::FeeBalance)
        .unwrap_or(0_i128)
}

pub fn add_to_fee_balance(env: &Env, amount: i128) {
    let current = get_fee_balance(env);
    env.storage()
        .instance()
        .set(&DataKey::FeeBalance, &(current + amount));
}

pub fn subtract_from_fee_balance(env: &Env, amount: i128) {
    let current = get_fee_balance(env);
    env.storage()
        .instance()
        .set(&DataKey::FeeBalance, &(current - amount));
}

// ── User tier ─────────────────────────────────────────────────────────────────

pub fn get_user_tier(env: &Env, user: &Address) -> UserTier {
    env.storage()
        .persistent()
        .get(&DataKey::UserTier(user.clone()))
        .unwrap_or(UserTier::Standard)
}

pub fn set_user_tier(env: &Env, user: &Address, tier: &UserTier) {
    env.storage()
        .persistent()
        .set(&DataKey::UserTier(user.clone()), tier);
}

// ── Operation waivers ─────────────────────────────────────────────────────────

pub fn is_operation_waived(env: &Env, operation: &Symbol) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::WaivedOperation(operation.clone()))
        .unwrap_or(false)
}

pub fn set_operation_waiver(env: &Env, operation: &Symbol, waived: bool) {
    env.storage()
        .instance()
        .set(&DataKey::WaivedOperation(operation.clone()), &waived);
}

// ── Convenience constants ─────────────────────────────────────────────────────

pub const BPS_DENOMINATOR: u32 = 10_000;

/// symbol_short aliases exposed for use in tests / other modules
pub fn op_transfer() -> Symbol {
    symbol_short!("transfer")
}

pub fn op_swap() -> Symbol {
    symbol_short!("swap")
}

pub fn op_stake() -> Symbol {
    symbol_short!("stake")
}
