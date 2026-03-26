use soroban_sdk::{symbol_short, Address, Env, Symbol};

use crate::types::FeeConfig;

// ── Topic symbols ─────────────────────────────────────────────────────────────

fn topic_fee_collected() -> Symbol {
    symbol_short!("fee_coll")
}

fn topic_fee_withdrawn() -> Symbol {
    symbol_short!("fee_with")
}

fn topic_config_set() -> Symbol {
    symbol_short!("cfg_set")
}

fn topic_tier_set() -> Symbol {
    symbol_short!("tier_set")
}

fn topic_waiver_set() -> Symbol {
    symbol_short!("waiver")
}

// ── Emitters ──────────────────────────────────────────────────────────────────

/// Emitted every time a fee is collected from a payer.
pub fn emit_fee_collected(
    env: &Env,
    payer: &Address,
    gross_amount: i128,
    fee_amount: i128,
    operation: &Symbol,
) {
    env.events().publish(
        (topic_fee_collected(), payer.clone()),
        (gross_amount, fee_amount, operation.clone()),
    );
}

/// Emitted when the admin withdraws accumulated fees.
pub fn emit_fee_withdrawn(env: &Env, recipient: &Address, amount: i128) {
    env.events().publish(
        (topic_fee_withdrawn(), recipient.clone()),
        amount,
    );
}

/// Emitted when the fee configuration is updated.
pub fn emit_config_set(env: &Env, admin: &Address, config: &FeeConfig) {
    env.events().publish(
        (topic_config_set(), admin.clone()),
        (config.base_fee_bps,),
    );
}

/// Emitted when a user's tier is changed.
pub fn emit_tier_set(env: &Env, user: &Address, tier_symbol: &Symbol) {
    env.events()
        .publish((topic_tier_set(), user.clone()), tier_symbol.clone());
}

/// Emitted when a fee waiver is toggled for an operation.
pub fn emit_waiver_set(env: &Env, operation: &Symbol, waived: bool) {
    env.events()
        .publish((topic_waiver_set(), operation.clone()), waived);
}
