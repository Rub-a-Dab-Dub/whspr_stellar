use crate::types::GroupId;
use soroban_sdk::{Address, Env, Symbol};

/// Emitted when a gate is set on a group
pub fn emit_gate_set(
    env: &Env,
    group_id: &GroupId,
    token: &Address,
    min_balance: i128,
    admin: &Address,
) {
    env.events().publish(
        (Symbol::new(env, "gate_set"), group_id),
        (token, min_balance, admin),
    );
}

/// Emitted when a gate is removed from a group
pub fn emit_gate_removed(env: &Env, group_id: &GroupId, removed_by: &Address) {
    env.events()
        .publish((Symbol::new(env, "gate_removed"), group_id), removed_by);
}

/// Emitted when a user is denied access due to insufficient token balance
pub fn emit_access_denied(
    env: &Env,
    group_id: &GroupId,
    user: &Address,
    required: i128,
    actual: i128,
) {
    env.events().publish(
        (Symbol::new(env, "access_denied"), group_id),
        (user, required, actual),
    );
}
