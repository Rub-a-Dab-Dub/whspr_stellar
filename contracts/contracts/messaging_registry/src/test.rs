#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, BytesN, Env,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

fn make_env() -> Env {
    Env::default()
}

fn register(env: &Env) -> (Address, MessagingRegistryContractClient) {
    let contract_id = env.register(MessagingRegistryContract, ());
    let client = MessagingRegistryContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin);
    (admin, client)
}

fn make_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn advance_time(env: &Env, seconds: u64) {
    let current = env.ledger().timestamp();
    env.ledger().set(LedgerInfo {
        timestamp: current + seconds,
        ..env.ledger().get()
    });
}

// ── Conversation Tests ────────────────────────────────────────────────────────

#[test]
fn test_create_conversation_success() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();

    // Must be retrievable
    let conv = client.get_conversation(&alice, &conv_id).unwrap();
    assert!(conv.is_active);
    assert_eq!(conv.message_count, 0);
}

#[test]
fn test_create_duplicate_conversation_fails() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    client.create_conversation(&alice, &bob).unwrap();

    let result = client.create_conversation(&alice, &bob);
    assert_eq!(result, Err(Ok(MessagingError::ConversationAlreadyExists)));
}

#[test]
fn test_create_conversation_order_independent() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    client.create_conversation(&alice, &bob).unwrap();

    // Bob creating with Alice should also fail as duplicate
    let result = client.create_conversation(&bob, &alice);
    assert_eq!(result, Err(Ok(MessagingError::ConversationAlreadyExists)));
}

#[test]
fn test_get_conversation_unauthorized() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let charlie = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();

    let result = client.get_conversation(&charlie, &conv_id);
    assert_eq!(result, Err(Ok(MessagingError::Unauthorized)));
}

// ── Messaging Tests ───────────────────────────────────────────────────────────

#[test]
fn test_send_message_success() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();
    let hash = make_hash(&env, 0xAB);
    let ts = env.ledger().timestamp();

    let msg_id = client.send_message(&alice, &conv_id, &hash, &ts).unwrap();

    let msg = client.get_message(&bob, &msg_id).unwrap();
    assert_eq!(msg.message_hash, hash);
    assert!(!msg.is_deleted);
    assert!(!msg.is_delivered);
}

#[test]
fn test_send_message_non_participant_fails() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let eve = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();
    let hash = make_hash(&env, 0x01);
    let ts = env.ledger().timestamp();

    let result = client.send_message(&eve, &conv_id, &hash, &ts);
    assert_eq!(result, Err(Ok(MessagingError::Unauthorized)));
}

#[test]
fn test_get_conversation_messages() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();
    let ts = env.ledger().timestamp();

    client
        .send_message(&alice, &conv_id, &make_hash(&env, 1), &ts)
        .unwrap();
    client
        .send_message(&bob, &conv_id, &make_hash(&env, 2), &ts)
        .unwrap();
    client
        .send_message(&alice, &conv_id, &make_hash(&env, 3), &ts)
        .unwrap();

    let messages = client.get_conversation_messages(&alice, &conv_id).unwrap();
    assert_eq!(messages.len(), 3);
}

// ── Receipt Tests ─────────────────────────────────────────────────────────────

#[test]
fn test_mark_delivered_by_recipient() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();
    let ts = env.ledger().timestamp();
    let msg_id = client
        .send_message(&alice, &conv_id, &make_hash(&env, 1), &ts)
        .unwrap();

    client.mark_delivered(&bob, &msg_id).unwrap();

    let msg = client.get_message(&alice, &msg_id).unwrap();
    assert!(msg.is_delivered);
}

#[test]
fn test_sender_cannot_mark_own_message_delivered() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();
    let ts = env.ledger().timestamp();
    let msg_id = client
        .send_message(&alice, &conv_id, &make_hash(&env, 1), &ts)
        .unwrap();

    let result = client.mark_delivered(&alice, &msg_id);
    assert_eq!(result, Err(Ok(MessagingError::Unauthorized)));
}

#[test]
fn test_mark_read_implies_delivered() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();
    let ts = env.ledger().timestamp();
    let msg_id = client
        .send_message(&alice, &conv_id, &make_hash(&env, 1), &ts)
        .unwrap();

    client.mark_read(&bob, &msg_id).unwrap();

    let msg = client.get_message(&alice, &msg_id).unwrap();
    assert!(msg.is_delivered);
    assert!(msg.is_read);
}

// ── Tombstone Deletion Tests ──────────────────────────────────────────────────

#[test]
fn test_delete_message_tombstone() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();
    let ts = env.ledger().timestamp();
    let msg_id = client
        .send_message(&alice, &conv_id, &make_hash(&env, 1), &ts)
        .unwrap();

    client.delete_message(&alice, &msg_id).unwrap();

    // Record still present but zeroed
    let msg = client.get_message(&bob, &msg_id).unwrap();
    assert!(msg.is_deleted);
    assert_eq!(msg.message_hash, BytesN::from_array(&env, &[0u8; 32]));
}

#[test]
fn test_non_sender_cannot_delete() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();
    let ts = env.ledger().timestamp();
    let msg_id = client
        .send_message(&alice, &conv_id, &make_hash(&env, 1), &ts)
        .unwrap();

    let result = client.delete_message(&bob, &msg_id);
    assert_eq!(result, Err(Ok(MessagingError::Unauthorized)));
}

#[test]
fn test_double_delete_fails() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();
    let ts = env.ledger().timestamp();
    let msg_id = client
        .send_message(&alice, &conv_id, &make_hash(&env, 1), &ts)
        .unwrap();

    client.delete_message(&alice, &msg_id).unwrap();
    let result = client.delete_message(&alice, &msg_id);
    assert_eq!(result, Err(Ok(MessagingError::MessageAlreadyDeleted)));
}

#[test]
fn test_deleted_message_still_in_history() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();
    let ts = env.ledger().timestamp();
    client
        .send_message(&alice, &conv_id, &make_hash(&env, 1), &ts)
        .unwrap();
    let msg2 = client
        .send_message(&alice, &conv_id, &make_hash(&env, 2), &ts)
        .unwrap();
    client
        .send_message(&alice, &conv_id, &make_hash(&env, 3), &ts)
        .unwrap();

    client.delete_message(&alice, &msg2).unwrap();

    let messages = client.get_conversation_messages(&alice, &conv_id).unwrap();
    assert_eq!(messages.len(), 3); // tombstone still in list
}

// ── TTL / Expiry Tests ────────────────────────────────────────────────────────

#[test]
fn test_send_message_on_expired_conversation_fails() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();

    // Wind the clock far forward past TTL
    advance_time(&env, 99_999_999);

    let ts = env.ledger().timestamp();
    let result = client.send_message(&alice, &conv_id, &make_hash(&env, 1), &ts);
    assert_eq!(result, Err(Ok(MessagingError::ConversationExpired)));
}

#[test]
fn test_extend_conversation_ttl() {
    let env = make_env();
    let (_, client) = register(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    env.mock_all_auths();
    let conv_id = client.create_conversation(&alice, &bob).unwrap();

    client
        .extend_conversation_ttl(&alice, &conv_id, &(365 * 24 * 3600))
        .unwrap();

    let conv = client.get_conversation(&alice, &conv_id).unwrap();
    assert!(conv.expires_at > env.ledger().timestamp());
}
