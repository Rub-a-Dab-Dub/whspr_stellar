use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup_token(env: &Env) -> (WhsprTokenClient<'_>, Address, Address, Address) {
    let contract_id = env.register(WhsprToken, ());
    let client = WhsprTokenClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let user_a = Address::generate(env);
    let user_b = Address::generate(env);

    client.initialize(
        &admin,
        &7,
        &String::from_str(env, "Whspr Token"),
        &String::from_str(env, "WHSPR"),
    );

    (client, admin, user_a, user_b)
}

#[test]
fn test_initialize_and_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, user, _) = setup_token(&env);

    client.mint(&user, &1_000_000_000);
    assert_eq!(client.balance(&user), 1_000_000_000);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, user_a, user_b) = setup_token(&env);

    client.mint(&user_a, &1_000);
    client.transfer(&user_a, &user_b, &400);

    assert_eq!(client.balance(&user_a), 600);
    assert_eq!(client.balance(&user_b), 400);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_transfer_insufficient_balance_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, user_a, user_b) = setup_token(&env);
    client.mint(&user_a, &100);
    client.transfer(&user_a, &user_b, &200);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_initialize_rejects_invalid_metadata_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(WhsprToken, ());
    let client = WhsprTokenClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(
        &admin,
        &0,
        &String::from_str(&env, "Whspr Token"),
        &String::from_str(&env, "WHSPR"),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_mint_rejects_zero_or_negative_amount_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, user_a, _) = setup_token(&env);
    client.mint(&user_a, &-1);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_transfer_rejects_zero_amount_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, user_a, user_b) = setup_token(&env);
    client.mint(&user_a, &100);
    client.transfer(&user_a, &user_b, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_mint_rate_limited_within_same_window_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, user_a, _) = setup_token(&env);
    client.mint(&user_a, &1);
    client.mint(&user_a, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_transfer_rate_limited_within_same_window_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, user_a, user_b) = setup_token(&env);
    client.mint(&user_a, &10);
    client.transfer(&user_a, &user_b, &1);
    client.transfer(&user_a, &user_b, &1);
}
