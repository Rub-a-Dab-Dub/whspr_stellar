#![allow(deprecated)]
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};

use crate::{XpContract, XpContractClient};

fn setup() -> (Env, Address, XpContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, XpContract);
    let client = XpContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, admin, client)
}

// ── Happy paths ──────────────────────────────────────────────────────────────

#[test]
fn award_xp_accumulates() {
    let (env, _admin, client) = setup();
    let user = Address::generate(&env);
    client.award_xp(&user, &10, &symbol_short!("message"));
    client.award_xp(&user, &20, &symbol_short!("tip"));
    assert_eq!(client.get_xp(&user), 30);
}

#[test]
fn get_xp_returns_zero_for_new_user() {
    let (env, _, client) = setup();
    let user = Address::generate(&env);
    assert_eq!(client.get_xp(&user), 0);
}

#[test]
fn get_level_returns_zero_below_threshold() {
    let (env, _, client) = setup();
    let user = Address::generate(&env);
    assert_eq!(client.get_level(&user), 0);
}

#[test]
fn level_up_at_1000_xp() {
    let (env, _, client) = setup();
    let user = Address::generate(&env);
    // 999 XP → still level 0
    client.award_xp(&user, &999, &symbol_short!("message"));
    assert_eq!(client.get_level(&user), 0);
    // +1 → 1000 XP → level 1
    let new_level = client.award_xp(&user, &1, &symbol_short!("message"));
    assert_eq!(new_level, 1);
    assert_eq!(client.get_level(&user), 1);
}

#[test]
fn no_level_up_returns_zero() {
    let (env, _, client) = setup();
    let user = Address::generate(&env);
    let result = client.award_xp(&user, &10, &symbol_short!("message"));
    assert_eq!(result, 0);
}

#[test]
fn multiple_level_ups_in_one_award() {
    let (env, _, client) = setup();
    let user = Address::generate(&env);
    // Jump straight to 3000 XP → level 3
    let new_level = client.award_xp(&user, &3000, &symbol_short!("message"));
    assert_eq!(new_level, 3);
    assert_eq!(client.get_level(&user), 3);
}

// ── Sad paths ────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "already initialized")]
fn double_initialize_panics() {
    let (_env, admin, client) = setup();
    client.initialize(&admin);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn award_zero_xp_panics() {
    let (env, _, client) = setup();
    let user = Address::generate(&env);
    client.award_xp(&user, &0, &symbol_short!("message"));
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn award_negative_xp_panics() {
    let (env, _, client) = setup();
    let user = Address::generate(&env);
    client.award_xp(&user, &-1, &symbol_short!("message"));
}
