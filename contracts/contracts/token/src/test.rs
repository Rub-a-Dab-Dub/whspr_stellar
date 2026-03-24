use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_initialize_and_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(WhsprToken, ());
    let client = WhsprTokenClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Whspr Token"),
        &String::from_str(&env, "WHSPR"),
    );

    client.mint(&user, &1_000_000_000);
    assert_eq!(client.balance(&user), 1_000_000_000);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(WhsprToken, ());
    let client = WhsprTokenClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);

    client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Whspr Token"),
        &String::from_str(&env, "WHSPR"),
    );

    client.mint(&user_a, &1_000);
    client.transfer(&user_a, &user_b, &400);

    assert_eq!(client.balance(&user_a), 600);
    assert_eq!(client.balance(&user_b), 400);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn test_transfer_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(WhsprToken, ());
    let client = WhsprTokenClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);

    client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Whspr Token"),
        &String::from_str(&env, "WHSPR"),
    );

    client.mint(&user_a, &100);
    client.transfer(&user_a, &user_b, &200);
}
