use super::*;
use gasless_common::CROSS_CONTRACT_API_VERSION;
use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::Address as _, vec, Address, Env, String,
};

#[contract]
pub struct MockHello;

#[contractimpl]
impl MockHello {
    pub fn version(_env: Env) -> u32 {
        CROSS_CONTRACT_API_VERSION
    }

    pub fn hello(env: Env, to: soroban_sdk::Symbol) -> soroban_sdk::Vec<soroban_sdk::Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}

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
    assert_eq!(client.version(), CROSS_CONTRACT_API_VERSION);
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

#[test]
fn test_cross_contract_hello_from_registry() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, _) = setup_token(&env);
    let hello_id = env.register(MockHello, ());

    client.set_contract_registry_entry(&symbol_short!("hello"), &hello_id, &1);
    let response = client.hello_from_registry(&symbol_short!("Gasless"));
    assert_eq!(
        response,
        vec![&env, symbol_short!("Hello"), symbol_short!("Gasless")]
    );

}

#[test]
#[should_panic(expected = "Error(Contract, #14)")]
fn test_cross_contract_version_mismatch_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, _) = setup_token(&env);
    let hello_id = env.register(MockHello, ());
    client.set_contract_registry_entry(&symbol_short!("hello"), &hello_id, &99);

    // Expects fixed compatibility at version 1 in hello_from_registry.
    client.hello_from_registry(&symbol_short!("Gasless"));
}
