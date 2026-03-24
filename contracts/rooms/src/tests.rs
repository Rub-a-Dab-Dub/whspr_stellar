#![allow(deprecated)]
#![cfg(test)]
use soroban_sdk::{testutils::{Address as _, Ledger}, token, Address, Bytes, Env};

use crate::{RoomsContract, RoomsContractClient};

fn setup() -> (Env, Address, Address, RoomsContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, RoomsContract);
    let client = RoomsContractClient::new(&env, &contract_id);
    let platform = Address::generate(&env);
    let creator = Address::generate(&env);
    client.initialize(&platform);
    (env, platform, creator, client)
}

fn b(env: &Env, s: &str) -> Bytes {
    Bytes::from_slice(env, s.as_bytes())
}

fn create_token(env: &Env, admin: &Address) -> Address {
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    token::StellarAssetClient::new(env, &token_id).mint(admin, &1_000_000_000);
    token_id
}

// ── Happy paths ──────────────────────────────────────────────────────────────

#[test]
fn create_free_room_returns_xp() {
    let (env, _, creator, client) = setup();
    let xp = client.create_room(&creator, &b(&env, "r1"), &0, &None, &None);
    assert_eq!(xp, 50);
}

#[test]
fn create_room_stores_data() {
    let (env, _, creator, client) = setup();
    client.create_room(&creator, &b(&env, "r1"), &0, &None, &None);
    let room = client.get_room(&b(&env, "r1")).unwrap();
    assert_eq!(room.creator, creator);
    assert!(room.active);
}

#[test]
fn join_free_room_succeeds() {
    let (env, _, creator, client) = setup();
    let member = Address::generate(&env);
    client.create_room(&creator, &b(&env, "r1"), &0, &None, &None);
    client.join_room(&member, &b(&env, "r1"));
    assert!(client.is_member(&b(&env, "r1"), &member));
}

#[test]
fn join_paid_room_splits_fee() {
    let (env, platform, creator, client) = setup();
    let member = Address::generate(&env);
    let token_id = create_token(&env, &member);
    client.create_room(&creator, &b(&env, "r1"), &1000, &Some(token_id.clone()), &None);
    client.join_room(&member, &b(&env, "r1"));

    let tc = token::Client::new(&env, &token_id);
    assert_eq!(tc.balance(&creator), 980); // 98%
    assert_eq!(tc.balance(&platform), 20); // 2%
}

#[test]
fn expire_room_after_expiry() {
    let (env, _, creator, client) = setup();
    let expires_at: u64 = 1000;
    client.create_room(&creator, &b(&env, "r1"), &0, &None, &Some(expires_at));
    env.ledger().set_timestamp(1001);
    client.expire_room(&b(&env, "r1"));
    let room = client.get_room(&b(&env, "r1")).unwrap();
    assert!(!room.active);
}

// ── Sad paths ────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "room exists")]
fn create_duplicate_room_panics() {
    let (env, _, creator, client) = setup();
    client.create_room(&creator, &b(&env, "r1"), &0, &None, &None);
    client.create_room(&creator, &b(&env, "r1"), &0, &None, &None);
}

#[test]
#[should_panic(expected = "token required for paid room")]
fn create_paid_room_without_token_panics() {
    let (env, _, creator, client) = setup();
    client.create_room(&creator, &b(&env, "r1"), &100, &None, &None);
}

#[test]
#[should_panic(expected = "entry_fee cannot be negative")]
fn create_room_negative_fee_panics() {
    let (env, _, creator, client) = setup();
    client.create_room(&creator, &b(&env, "r1"), &-1, &None, &None);
}

#[test]
#[should_panic(expected = "room not found")]
fn join_nonexistent_room_panics() {
    let (env, _, _, client) = setup();
    let member = Address::generate(&env);
    client.join_room(&member, &b(&env, "ghost"));
}

#[test]
#[should_panic(expected = "already a member")]
fn join_room_twice_panics() {
    let (env, _, creator, client) = setup();
    let member = Address::generate(&env);
    client.create_room(&creator, &b(&env, "r1"), &0, &None, &None);
    client.join_room(&member, &b(&env, "r1"));
    client.join_room(&member, &b(&env, "r1"));
}

#[test]
#[should_panic(expected = "room expired")]
fn join_expired_room_panics() {
    let (env, _, creator, client) = setup();
    let member = Address::generate(&env);
    client.create_room(&creator, &b(&env, "r1"), &0, &None, &Some(500));
    env.ledger().set_timestamp(501);
    client.join_room(&member, &b(&env, "r1"));
}

#[test]
#[should_panic(expected = "not yet expired")]
fn expire_room_before_expiry_panics() {
    let (env, _, creator, client) = setup();
    client.create_room(&creator, &b(&env, "r1"), &0, &None, &Some(9999));
    env.ledger().set_timestamp(100);
    client.expire_room(&b(&env, "r1"));
}

#[test]
#[should_panic(expected = "already expired")]
fn expire_room_twice_panics() {
    let (env, _, creator, client) = setup();
    client.create_room(&creator, &b(&env, "r1"), &0, &None, &Some(500));
    env.ledger().set_timestamp(501);
    client.expire_room(&b(&env, "r1"));
    client.expire_room(&b(&env, "r1"));
}
