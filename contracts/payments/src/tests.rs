#![allow(deprecated)]
#![cfg(test)]
use soroban_sdk::{testutils::Address as _, token, Address, Bytes, Env};

use crate::{PaymentsContract, PaymentsContractClient};

/// Deploy a minimal SAC-compatible token and mint `amount` to `to`.
fn create_token(env: &Env, admin: &Address) -> Address {
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    token::StellarAssetClient::new(env, &token_id).mint(admin, &1_000_000_000);
    token_id
}

fn setup() -> (Env, Address, Address, Address, PaymentsContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, PaymentsContract);
    let client = PaymentsContractClient::new(&env, &contract_id);
    let platform = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.initialize(&platform);
    (env, platform, alice, bob, client)
}

#[test]
fn tip_splits_fee_correctly() {
    let (env, platform, alice, bob, client) = setup();
    let token_id = create_token(&env, &alice);
    // alice has 1_000_000_000; tip 1000
    let xp = client.tip(&alice, &bob, &token_id, &1000, &Bytes::from_slice(&env, b"room1"));
    assert_eq!(xp, 20);

    let tc = token::Client::new(&env, &token_id);
    // bob gets 98% = 980
    assert_eq!(tc.balance(&bob), 980);
    // platform gets 2% = 20
    assert_eq!(tc.balance(&platform), 20);
}

#[test]
fn transfer_moves_full_amount() {
    let (env, _, alice, bob, client) = setup();
    let token_id = create_token(&env, &alice);
    client.transfer(&alice, &bob, &token_id, &500);
    let tc = token::Client::new(&env, &token_id);
    assert_eq!(tc.balance(&bob), 500);
    assert_eq!(tc.balance(&alice), 999_999_500);
}

#[test]
fn tip_small_amount_fee_rounds_down() {
    // amount=1 → fee = 1*200/10000 = 0, net = 1
    let (env, platform, alice, bob, client) = setup();
    let token_id = create_token(&env, &alice);
    client.tip(&alice, &bob, &token_id, &1, &Bytes::from_slice(&env, b"r"));
    let tc = token::Client::new(&env, &token_id);
    assert_eq!(tc.balance(&bob), 1);
    assert_eq!(tc.balance(&platform), 0);
}

// ── Sad paths ────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "already initialized")]
fn double_initialize_panics() {
    let (_env, platform, _, _, client) = setup();
    client.initialize(&platform);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn tip_zero_amount_panics() {
    let (env, _, alice, bob, client) = setup();
    let token_id = create_token(&env, &alice);
    client.tip(&alice, &bob, &token_id, &0, &Bytes::from_slice(&env, b"r"));
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn tip_negative_amount_panics() {
    let (env, _, alice, bob, client) = setup();
    let token_id = create_token(&env, &alice);
    client.tip(&alice, &bob, &token_id, &-1, &Bytes::from_slice(&env, b"r"));
}

#[test]
#[should_panic(expected = "cannot tip self")]
fn tip_self_panics() {
    let (env, _, alice, _, client) = setup();
    let token_id = create_token(&env, &alice);
    client.tip(&alice, &alice, &token_id, &100, &Bytes::from_slice(&env, b"r"));
}

#[test]
#[should_panic(expected = "cannot transfer to self")]
fn transfer_self_panics() {
    let (env, _, alice, _, client) = setup();
    let token_id = create_token(&env, &alice);
    client.transfer(&alice, &alice, &token_id, &100);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn transfer_zero_panics() {
    let (env, _, alice, bob, client) = setup();
    let token_id = create_token(&env, &alice);
    client.transfer(&alice, &bob, &token_id, &0);
}

// ── Fuzz: transfer amount edge cases ────────────────────────────────────────

#[test]
fn fuzz_tip_amounts() {
    let amounts: &[i128] = &[1, 50, 99, 100, 999, 1_000, 9_999, 10_000, 999_999_999];
    for &amount in amounts {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, PaymentsContract);
        let client = PaymentsContractClient::new(&env, &contract_id);
        let platform = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.initialize(&platform);
        let token_id = create_token(&env, &alice);

        client.tip(&alice, &bob, &token_id, &amount, &Bytes::from_slice(&env, b"r"));

        let tc = token::Client::new(&env, &token_id);
        let fee = amount * 200 / 10_000;
        let net = amount - fee;
        assert_eq!(tc.balance(&bob), net, "amount={amount}");
        assert_eq!(tc.balance(&platform), fee, "amount={amount}");
    }
}
