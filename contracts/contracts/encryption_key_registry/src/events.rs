use soroban_sdk::{symbol_short, Address, BytesN, Env, Symbol};

pub fn emit_key_registered(
    env: &Env,
    owner: &Address,
    public_key: &BytesN<32>,
    version: u32,
    timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("key_reg"), owner.clone()),
        (public_key.clone(), version, timestamp),
    );
}

pub fn emit_key_rotated(
    env: &Env,
    owner: &Address,
    old_key: &BytesN<32>,
    new_key: &BytesN<32>,
    new_version: u32,
    timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("key_rot"), owner.clone()),
        (old_key.clone(), new_key.clone(), new_version, timestamp),
    );
}

pub fn emit_key_revoked(
    env: &Env,
    owner: &Address,
    public_key: &BytesN<32>,
    version: u32,
    timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("key_rev"), owner.clone()),
        (public_key.clone(), version, timestamp),
    );
}
