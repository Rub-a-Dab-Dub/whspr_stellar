#![allow(deprecated)]
use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};

use crate::{MessagingContract, MessagingContractClient};

fn setup() -> (Env, Address, MessagingContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, MessagingContract);
    let client = MessagingContractClient::new(&env, &contract_id);
    let sender = Address::generate(&env);
    (env, sender, client)
}

fn bytes(env: &Env, s: &str) -> Bytes {
    Bytes::from_slice(env, s.as_bytes())
}

// ── Happy paths ──────────────────────────────────────────────────────────────

#[test]
fn send_message_returns_xp() {
    let (env, sender, client) = setup();
    let xp = client.send_message(
        &sender,
        &bytes(&env, "msg1"),
        &bytes(&env, "room1"),
        &bytes(&env, "ipfs://hash"),
    );
    assert_eq!(xp, 10);
}

#[test]
fn send_message_stores_and_retrieves() {
    let (env, sender, client) = setup();
    client.send_message(
        &sender,
        &bytes(&env, "msg1"),
        &bytes(&env, "room1"),
        &bytes(&env, "ipfs://hash"),
    );
    let msg = client.get_message(&bytes(&env, "msg1")).unwrap();
    assert_eq!(msg.sender, sender);
    assert_eq!(msg.room_id, bytes(&env, "room1"));
}

#[test]
fn delete_message_by_sender_succeeds() {
    let (env, sender, client) = setup();
    client.send_message(
        &sender,
        &bytes(&env, "msg1"),
        &bytes(&env, "room1"),
        &bytes(&env, "ipfs://hash"),
    );
    client.delete_message(&sender, &bytes(&env, "msg1"));
    assert!(client.get_message(&bytes(&env, "msg1")).is_none());
}

#[test]
fn get_message_returns_none_for_unknown() {
    let (env, _, client) = setup();
    assert!(client.get_message(&bytes(&env, "nope")).is_none());
}

// ── Sad paths ────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "duplicate message_id")]
fn send_message_duplicate_id_panics() {
    let (env, sender, client) = setup();
    client.send_message(
        &sender,
        &bytes(&env, "msg1"),
        &bytes(&env, "r"),
        &bytes(&env, "h"),
    );
    client.send_message(
        &sender,
        &bytes(&env, "msg1"),
        &bytes(&env, "r"),
        &bytes(&env, "h"),
    );
}

#[test]
#[should_panic(expected = "invalid args")]
fn send_message_empty_id_panics() {
    let (env, sender, client) = setup();
    client.send_message(
        &sender,
        &bytes(&env, ""),
        &bytes(&env, "r"),
        &bytes(&env, "h"),
    );
}

#[test]
#[should_panic(expected = "message not found")]
fn delete_nonexistent_message_panics() {
    let (env, sender, client) = setup();
    client.delete_message(&sender, &bytes(&env, "ghost"));
}

#[test]
#[should_panic(expected = "unauthorized")]
fn delete_message_by_non_sender_panics() {
    let (env, sender, client) = setup();
    let other = Address::generate(&env);
    client.send_message(
        &sender,
        &bytes(&env, "msg1"),
        &bytes(&env, "r"),
        &bytes(&env, "h"),
    );
    client.delete_message(&other, &bytes(&env, "msg1"));
}
