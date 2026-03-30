use soroban_sdk::{symbol_short, Address, Env, String};

pub fn emit_registered(env: &Env, username: &String, owner: &Address, expires_at: u64) {
    env.events().publish(
        (symbol_short!("reg"), username.clone()),
        (owner.clone(), expires_at),
    );
}

pub fn emit_renewed(env: &Env, username: &String, owner: &Address, new_expires: u64) {
    env.events().publish(
        (symbol_short!("renewed"), username.clone()),
        (owner.clone(), new_expires),
    );
}

pub fn emit_transferred(env: &Env, username: &String, from: &Address, to: &Address) {
    env.events().publish(
        (symbol_short!("xfer"), username.clone()),
        (from.clone(), to.clone()),
    );
}

pub fn emit_released(env: &Env, username: &String, owner: &Address) {
    env.events().publish(
        (symbol_short!("released"), username.clone()),
        owner.clone(),
    );
}
