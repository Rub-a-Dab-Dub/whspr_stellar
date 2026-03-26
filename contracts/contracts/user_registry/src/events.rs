use soroban_sdk::{symbol_short, Address, BytesN, Env, Symbol};

pub fn emit_user_registered(
    env: &Env,
    address: &Address,
    username: &Symbol,
    public_key: &BytesN<32>,
    timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("user_reg"), address.clone()),
        (username.clone(), public_key.clone(), timestamp),
    );
}

pub fn emit_profile_updated(
    env: &Env,
    address: &Address,
    display_name: &Option<Symbol>,
    avatar_hash: &Option<BytesN<32>>,
    timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("prof_upd"), address.clone()),
        (display_name.clone(), avatar_hash.clone(), timestamp),
    );
}

pub fn emit_account_deactivated(
    env: &Env,
    address: &Address,
    username: &Symbol,
    timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("acc_deac"), address.clone()),
        (username.clone(), timestamp),
    );
}
