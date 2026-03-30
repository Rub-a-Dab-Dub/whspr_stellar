#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Env, String,
};

fn setup() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, UsernameRegistryContract);

    let token_admin = Address::generate(&env);
    let fee_token = env.register_stellar_asset_contract_v2(token_admin.clone()).address();

    UsernameRegistryContractClient::new(&env, &contract_id).initialize(&admin, &fee_token);
    (env, contract_id, admin, fee_token)
}

fn fund(env: &Env, token: &Address, user: &Address) {
    StellarAssetClient::new(env, token).mint(user, &1_000_000_000);
}

#[test]
fn test_register_and_resolve() {
    let (env, contract_id, _admin, fee_token) = setup();
    let client = UsernameRegistryContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    fund(&env, &fee_token, &owner);

    env.ledger().set_timestamp(1000);
    let name = String::from_str(&env, "alice");
    client.register(&owner, &name, &1u32);

    let resolved = client.resolve(&name);
    assert_eq!(resolved, owner);
}

#[test]
fn test_reverse_resolve() {
    let (env, contract_id, _admin, fee_token) = setup();
    let client = UsernameRegistryContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    fund(&env, &fee_token, &owner);

    env.ledger().set_timestamp(1000);
    let name = String::from_str(&env, "alice");
    client.register(&owner, &name, &1u32);

    let primary = client.reverse_resolve(&owner);
    assert_eq!(primary, name);
}

#[test]
#[should_panic(expected = "UsernameTaken")]
fn test_duplicate_registration_fails() {
    let (env, contract_id, _admin, fee_token) = setup();
    let client = UsernameRegistryContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let owner2 = Address::generate(&env);
    fund(&env, &fee_token, &owner);
    fund(&env, &fee_token, &owner2);

    env.ledger().set_timestamp(1000);
    let name = String::from_str(&env, "alice");
    client.register(&owner, &name, &1u32);
    client.register(&owner2, &name, &1u32);
}

#[test]
fn test_transfer() {
    let (env, contract_id, _admin, fee_token) = setup();
    let client = UsernameRegistryContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);
    fund(&env, &fee_token, &owner);

    env.ledger().set_timestamp(1000);
    let name = String::from_str(&env, "alice");
    client.register(&owner, &name, &1u32);
    client.transfer(&name, &new_owner);

    let resolved = client.resolve(&name);
    assert_eq!(resolved, new_owner);
}

#[test]
fn test_is_available_after_grace_period() {
    let (env, contract_id, _admin, fee_token) = setup();
    let client = UsernameRegistryContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    fund(&env, &fee_token, &owner);

    env.ledger().set_timestamp(1000);
    let name = String::from_str(&env, "alice");
    client.register(&owner, &name, &1u32);

    let expiry = 1000 + types::SECS_PER_YEAR;
    env.ledger().set_timestamp(expiry + types::GRACE_PERIOD + 1);
    assert!(client.is_available(&name));
}

#[test]
#[should_panic(expected = "InvalidUsername")]
fn test_short_username_rejected() {
    let (env, contract_id, _admin, fee_token) = setup();
    let client = UsernameRegistryContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    fund(&env, &fee_token, &owner);

    env.ledger().set_timestamp(1000);
    let name = String::from_str(&env, "ab"); // 2 chars, too short
    client.register(&owner, &name, &1u32);
}

#[test]
fn test_release() {
    let (env, contract_id, _admin, fee_token) = setup();
    let client = UsernameRegistryContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    fund(&env, &fee_token, &owner);

    env.ledger().set_timestamp(1000);
    let name = String::from_str(&env, "alice");
    client.register(&owner, &name, &1u32);
    client.release(&name);

    env.ledger().set_timestamp(1000 + types::GRACE_PERIOD + 1);
    assert!(client.is_available(&name));
}
