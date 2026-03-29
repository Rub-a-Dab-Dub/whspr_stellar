use crate::types::{GateConfig, GroupId};
use soroban_sdk::{symbol_short, Env, Symbol};

const GATE_KEY: Symbol = symbol_short!("GATE");

/// Save a gate config for a group
pub fn save_gate(env: &Env, group_id: &GroupId, config: &GateConfig) {
    let key = (GATE_KEY, group_id.clone());
    env.storage().persistent().set(&key, config);
    env.storage().persistent().extend_ttl(&key, 100000, 100000);
}

/// Get the gate config for a group, returns None if no gate is set
pub fn get_gate(env: &Env, group_id: &GroupId) -> Option<GateConfig> {
    let key = (GATE_KEY, group_id.clone());
    env.storage().persistent().get(&key)
}

/// Remove the gate config for a group
pub fn remove_gate(env: &Env, group_id: &GroupId) {
    let key = (GATE_KEY, group_id.clone());
    env.storage().persistent().remove(&key);
}
