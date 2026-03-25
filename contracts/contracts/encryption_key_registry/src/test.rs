#![cfg(test)]

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, BytesN, Env,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup() -> (Env, EncryptionKeyRegistryContractClient<'static>) {
    let env = Env::default();
    let contract_id = env.register(EncryptionKeyRegistryContract, ());
    let client = EncryptionKeyRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin).unwrap();
    (env, client)
}

fn make_key(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn x25519(env: &Env) -> soroban_sdk::Symbol {
    symbol_short!("x25519")
}

fn advance(env: &Env, secs: u64) {
    let t = env.ledger().timestamp();
    env.ledger().set(LedgerInfo {
        timestamp: t + secs,
        ..env.ledger().get()
    });
}

// ── Initialization ────────────────────────────────────────────────────────────

#[test]
fn test_double_initialize_fails() {
    let (env, client) = setup();
    let admin2 = Address::generate(&env);
    env.mock_all_auths();
    let result = client.initialize(&admin2);
    assert_eq!(result, Err(Ok(KeyRegistryError::AlreadyInitialized)));
}

// ── Register ─────────────────────────────────────────────────────────────────

#[test]
fn test_register_key_success() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    let version = client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    assert_eq!(version, 1);

    let record = client.get_key(&alice).unwrap();
    assert!(record.is_active);
    assert_eq!(record.version, 1);
    assert_eq!(record.revoked_at, 0);
}

#[test]
fn test_register_zero_key_fails() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    let result = client.register_key(&alice, &BytesN::from_array(&env, &[0u8; 32]), &x25519(&env));
    assert_eq!(result, Err(Ok(KeyRegistryError::InvalidPublicKey)));
}

#[test]
fn test_register_twice_without_rotation_fails() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    let result = client.register_key(&alice, &make_key(&env, 2), &x25519(&env));
    assert_eq!(result, Err(Ok(KeyRegistryError::Unauthorized)));
}

#[test]
fn test_register_after_revoke_succeeds() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    client.revoke_key(&alice).unwrap();

    let version = client
        .register_key(&alice, &make_key(&env, 2), &x25519(&env))
        .unwrap();
    assert_eq!(version, 2);
}

// ── Rotation ─────────────────────────────────────────────────────────────────

#[test]
fn test_rotate_key_success() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    advance(&env, 100);

    let new_version = client
        .rotate_key(&alice, &make_key(&env, 2), &x25519(&env))
        .unwrap();
    assert_eq!(new_version, 2);

    let record = client.get_key(&alice).unwrap();
    assert!(record.is_active);
    assert_eq!(record.public_key, make_key(&env, 2));
    assert_eq!(record.version, 2);
}

#[test]
fn test_rotate_without_existing_key_fails() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    let result = client.rotate_key(&alice, &make_key(&env, 1), &x25519(&env));
    assert_eq!(result, Err(Ok(KeyRegistryError::KeyNotFound)));
}

#[test]
fn test_rotate_zero_key_fails() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    let result = client.rotate_key(&alice, &BytesN::from_array(&env, &[0u8; 32]), &x25519(&env));
    assert_eq!(result, Err(Ok(KeyRegistryError::InvalidPublicKey)));
}

#[test]
fn test_rotate_after_revoke_fails() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    client.revoke_key(&alice).unwrap();

    let result = client.rotate_key(&alice, &make_key(&env, 2), &x25519(&env));
    assert_eq!(result, Err(Ok(KeyRegistryError::NoActiveKey)));
}

// ── Revocation ────────────────────────────────────────────────────────────────

#[test]
fn test_revoke_key_sets_timestamp() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    advance(&env, 500);
    let revoke_time = env.ledger().timestamp();
    client.revoke_key(&alice).unwrap();

    let record = client.get_key(&alice).unwrap();
    assert!(!record.is_active);
    assert_eq!(record.revoked_at, revoke_time);
}

#[test]
fn test_double_revoke_fails() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    client.revoke_key(&alice).unwrap();

    let result = client.revoke_key(&alice);
    assert_eq!(result, Err(Ok(KeyRegistryError::KeyAlreadyRevoked)));
}

#[test]
fn test_revoke_without_key_fails() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    let result = client.revoke_key(&alice);
    assert_eq!(result, Err(Ok(KeyRegistryError::KeyNotFound)));
}

// ── History ───────────────────────────────────────────────────────────────────

#[test]
fn test_key_history_grows_with_rotation() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    client
        .rotate_key(&alice, &make_key(&env, 2), &x25519(&env))
        .unwrap();
    client
        .rotate_key(&alice, &make_key(&env, 3), &x25519(&env))
        .unwrap();

    // register: 1 entry; rotate once: old+new = +2; rotate again: old+new = +2 → 5 total
    let history = client.get_key_history(&alice);
    assert_eq!(history.len(), 5);
}

#[test]
fn test_key_history_contains_revoked_entry() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    client.revoke_key(&alice).unwrap();

    let history = client.get_key_history(&alice);
    // register + revoke update = 2 entries
    assert_eq!(history.len(), 2);

    let last = history.get(1).unwrap();
    assert!(!last.is_active);
    assert!(last.revoked_at > 0);
}

#[test]
fn test_empty_history_for_unknown_address() {
    let (env, client) = setup();
    let stranger = Address::generate(&env);

    let history = client.get_key_history(&stranger);
    assert_eq!(history.len(), 0);
}

// ── has_active_key ────────────────────────────────────────────────────────────

#[test]
fn test_has_active_key_lifecycle() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    env.mock_all_auths();

    assert!(!client.has_active_key(&alice));

    client
        .register_key(&alice, &make_key(&env, 1), &x25519(&env))
        .unwrap();
    assert!(client.has_active_key(&alice));

    client.revoke_key(&alice).unwrap();
    assert!(!client.has_active_key(&alice));
}

// ── Key exchange integration flow ─────────────────────────────────────────────

#[test]
fn test_key_exchange_flow() {
    let (env, client) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    env.mock_all_auths();

    // Both parties register their public keys.
    client
        .register_key(&alice, &make_key(&env, 0xAA), &x25519(&env))
        .unwrap();
    client
        .register_key(&bob, &make_key(&env, 0xBB), &x25519(&env))
        .unwrap();

    // Each can retrieve the other's public key for ECDH.
    let alice_key = client.get_key(&alice).unwrap();
    let bob_key = client.get_key(&bob).unwrap();

    assert!(alice_key.is_active);
    assert!(bob_key.is_active);
    assert_ne!(alice_key.public_key, bob_key.public_key);

    // Alice rotates; Bob can now fetch Alice's new key.
    advance(&env, 1000);
    client
        .rotate_key(&alice, &make_key(&env, 0xCC), &x25519(&env))
        .unwrap();

    let alice_new = client.get_key(&alice).unwrap();
    assert_eq!(alice_new.public_key, make_key(&env, 0xCC));
    assert_eq!(alice_new.version, 2);

    // Old key still accessible in history for forward secrecy verification.
    let history = client.get_key_history(&alice);
    let old = history.get(0).unwrap();
    assert_eq!(old.public_key, make_key(&env, 0xAA));
}
