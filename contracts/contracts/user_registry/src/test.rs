#![cfg(test)]

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, BytesN, Env,
};

fn create_test_env() -> Env {
    Env::default()
}

fn create_test_key(env: &Env, seed: u8) -> BytesN<32> {
    let mut bytes = [seed; 32];
    bytes[0] = seed;
    BytesN::from_array(env, &bytes)
}

#[test]
fn test_initialize() {
    let env = create_test_env();
    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.initialize(&admin);

    let stored_admin = client.get_admin();
    assert_eq!(stored_admin, admin);
}

#[test]
#[should_panic(expected = "AlreadyInitialized")]
fn test_initialize_twice_fails() {
    let env = create_test_env();
    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.initialize(&admin);
    client.initialize(&admin); // Should panic
}

#[test]
fn test_register_user() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);

    let record = client.get_user(&user);
    assert_eq!(record.address, user);
    assert_eq!(record.username, username);
    assert_eq!(record.public_key, public_key);
    assert_eq!(record.display_name, None);
    assert_eq!(record.avatar_hash, None);
    assert!(record.is_active);

    let user_count = client.get_user_count();
    assert_eq!(user_count, 1);
}

#[test]
#[should_panic(expected = "UserAlreadyRegistered")]
fn test_register_user_twice_fails() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);
    client.register(&user, &symbol_short!("bob"), &create_test_key(&env, 2)); // Should panic
}

#[test]
#[should_panic(expected = "UsernameTaken")]
fn test_register_duplicate_username_fails() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let username = symbol_short!("alice");

    client.register(&user1, &username, &create_test_key(&env, 1));
    client.register(&user2, &username, &create_test_key(&env, 2)); // Should panic
}

#[test]
#[should_panic(expected = "InvalidPublicKey")]
fn test_register_with_zero_key_fails() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let zero_key = BytesN::from_array(&env, &[0u8; 32]);

    client.register(&user, &username, &zero_key); // Should panic
}

#[test]
fn test_update_profile() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);

    // Update profile
    let display_name = Some(symbol_short!("Alice"));
    let avatar_hash = Some(create_test_key(&env, 99));

    client.update_profile(&user, &display_name, &avatar_hash);

    let record = client.get_user(&user);
    assert_eq!(record.display_name, display_name);
    assert_eq!(record.avatar_hash, avatar_hash);
}

#[test]
fn test_update_profile_partial() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);

    // Update only display name
    let display_name = Some(symbol_short!("Alice"));
    client.update_profile(&user, &display_name, &None);

    let record = client.get_user(&user);
    assert_eq!(record.display_name, display_name);
    assert_eq!(record.avatar_hash, None);
}

#[test]
#[should_panic(expected = "UserNotFound")]
fn test_update_profile_unregistered_user_fails() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let display_name = Some(symbol_short!("Alice"));

    client.update_profile(&user, &display_name, &None); // Should panic
}

#[test]
fn test_resolve_username() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);

    let resolved_address = client.resolve_username(&username);
    assert_eq!(resolved_address, user);
}

#[test]
#[should_panic(expected = "UserNotFound")]
fn test_resolve_nonexistent_username_fails() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    client.resolve_username(&symbol_short!("nobody")); // Should panic
}

#[test]
fn test_is_username_available() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let username = symbol_short!("alice");
    assert!(client.is_username_available(&username));

    let user = Address::generate(&env);
    let public_key = create_test_key(&env, 1);
    client.register(&user, &username, &public_key);

    assert!(!client.is_username_available(&username));
}

#[test]
fn test_deactivate_account() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);

    let record = client.get_user(&user);
    assert!(record.is_active);

    client.deactivate_account(&user);

    let record = client.get_user(&user);
    assert!(!record.is_active);
}

#[test]
#[should_panic(expected = "AccountDeactivated")]
fn test_deactivate_account_twice_fails() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);
    client.deactivate_account(&user);
    client.deactivate_account(&user); // Should panic
}

#[test]
#[should_panic(expected = "AccountDeactivated")]
fn test_update_profile_deactivated_account_fails() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);
    client.deactivate_account(&user);

    let display_name = Some(symbol_short!("Alice"));
    client.update_profile(&user, &display_name, &None); // Should panic
}

#[test]
fn test_admin_deactivate_account() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);

    let record = client.get_user(&user);
    assert!(record.is_active);

    client.admin_deactivate_account(&admin, &user);

    let record = client.get_user(&user);
    assert!(!record.is_active);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_admin_deactivate_by_non_admin_fails() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);

    let non_admin = Address::generate(&env);
    client.admin_deactivate_account(&non_admin, &user); // Should panic
}

#[test]
fn test_user_count_increments() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    assert_eq!(client.get_user_count(), 0);

    for i in 1..=5 {
        let user = Address::generate(&env);
        let username = Symbol::new(&env, &format!("user{}", i));
        let public_key = create_test_key(&env, i as u8);
        client.register(&user, &username, &public_key);
        assert_eq!(client.get_user_count(), i);
    }
}

#[test]
fn test_multiple_users_registration() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);

    client.register(&user1, &symbol_short!("alice"), &create_test_key(&env, 1));
    client.register(&user2, &symbol_short!("bob"), &create_test_key(&env, 2));
    client.register(&user3, &symbol_short!("charlie"), &create_test_key(&env, 3));

    assert_eq!(client.get_user_count(), 3);

    let record1 = client.get_user(&user1);
    let record2 = client.get_user(&user2);
    let record3 = client.get_user(&user3);

    assert_eq!(record1.username, symbol_short!("alice"));
    assert_eq!(record2.username, symbol_short!("bob"));
    assert_eq!(record3.username, symbol_short!("charlie"));
}

#[test]
fn test_timestamp_updates() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Set initial ledger timestamp
    env.ledger().set(LedgerInfo {
        timestamp: 1000,
        protocol_version: 20,
        sequence_number: 10,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);

    let record = client.get_user(&user);
    assert_eq!(record.registered_at, 1000);
    assert_eq!(record.updated_at, 1000);

    // Advance time
    env.ledger().set(LedgerInfo {
        timestamp: 2000,
        protocol_version: 20,
        sequence_number: 20,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });

    let display_name = Some(symbol_short!("Alice"));
    client.update_profile(&user, &display_name, &None);

    let record = client.get_user(&user);
    assert_eq!(record.registered_at, 1000); // Should not change
    assert_eq!(record.updated_at, 2000); // Should update
}
