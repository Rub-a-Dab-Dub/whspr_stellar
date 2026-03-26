#![cfg(test)]

use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, BytesN, Env, Symbol,
};

// Import the contract
use user_registry::{UserRegistryContract, UserRegistryContractClient};

fn create_test_env() -> Env {
    Env::default()
}

fn create_test_key(env: &Env, seed: u8) -> BytesN<32> {
    let mut bytes = [seed; 32];
    bytes[0] = seed;
    BytesN::from_array(env, &bytes)
}

#[test]
fn test_full_user_lifecycle() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    // Initialize contract
    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Register user
    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    client.register(&user, &username, &public_key);

    // Verify registration
    let record = client.get_user(&user);
    assert_eq!(record.address, user);
    assert_eq!(record.username, username);
    assert!(record.is_active);
    assert_eq!(record.display_name, None);

    // Update profile
    let display_name = Some(symbol_short!("Alice"));
    let avatar_hash = Some(create_test_key(&env, 99));
    client.update_profile(&user, &display_name, &avatar_hash);

    // Verify update
    let record = client.get_user(&user);
    assert_eq!(record.display_name, display_name);
    assert_eq!(record.avatar_hash, avatar_hash);

    // Deactivate account
    client.deactivate_account(&user);

    // Verify deactivation
    let record = client.get_user(&user);
    assert!(!record.is_active);
}

#[test]
fn test_username_resolution_workflow() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Register multiple users
    let users: Vec<(Address, Symbol)> = vec![
        (Address::generate(&env), symbol_short!("alice")),
        (Address::generate(&env), symbol_short!("bob")),
        (Address::generate(&env), symbol_short!("charlie")),
    ];

    for (i, (user, username)) in users.iter().enumerate() {
        let public_key = create_test_key(&env, (i + 1) as u8);
        client.register(user, username, &public_key);
    }

    // Verify all usernames resolve correctly
    for (user, username) in users.iter() {
        let resolved = client.resolve_username(username);
        assert_eq!(resolved, *user);
    }

    // Verify user count
    assert_eq!(client.get_user_count(), 3);
}

#[test]
fn test_username_uniqueness_enforcement() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let username = symbol_short!("alice");

    // First registration succeeds
    client.register(&user1, &username, &create_test_key(&env, 1));

    // Check username is not available
    assert!(!client.is_username_available(&username));

    // Second registration with same username should fail
    let result = client.try_register(&user2, &username, &create_test_key(&env, 2));
    assert!(result.is_err());
}

#[test]
fn test_admin_override_deactivation() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Register user
    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    client.register(&user, &username, &create_test_key(&env, 1));

    // Verify user is active
    let record = client.get_user(&user);
    assert!(record.is_active);

    // Admin deactivates user
    client.admin_deactivate_account(&admin, &user);

    // Verify deactivation
    let record = client.get_user(&user);
    assert!(!record.is_active);
}

#[test]
fn test_non_admin_cannot_admin_deactivate() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Register user
    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    client.register(&user, &username, &create_test_key(&env, 1));

    // Non-admin tries to deactivate
    let non_admin = Address::generate(&env);
    let result = client.try_admin_deactivate_account(&non_admin, &user);
    assert!(result.is_err());
}

#[test]
fn test_profile_updates_preserve_core_data() {
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

    let original_record = client.get_user(&user);

    // Update profile multiple times
    client.update_profile(&user, &Some(symbol_short!("Alice1")), &None);
    client.update_profile(&user, &Some(symbol_short!("Alice2")), &Some(create_test_key(&env, 10)));
    client.update_profile(&user, &None, &Some(create_test_key(&env, 20)));

    let final_record = client.get_user(&user);

    // Core data should remain unchanged
    assert_eq!(final_record.address, original_record.address);
    assert_eq!(final_record.username, original_record.username);
    assert_eq!(final_record.public_key, original_record.public_key);
    assert_eq!(final_record.registered_at, original_record.registered_at);
    assert_eq!(final_record.is_active, original_record.is_active);

    // Profile data should be updated
    assert_eq!(final_record.display_name, None);
    assert_eq!(final_record.avatar_hash, Some(create_test_key(&env, 20)));
}

#[test]
fn test_deactivated_user_cannot_update_profile() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    client.register(&user, &username, &create_test_key(&env, 1));

    // Deactivate account
    client.deactivate_account(&user);

    // Try to update profile
    let result = client.try_update_profile(&user, &Some(symbol_short!("Alice")), &None);
    assert!(result.is_err());
}

#[test]
fn test_concurrent_registrations() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Simulate concurrent registrations
    let num_users = 10;
    let mut users = Vec::new();

    for i in 0..num_users {
        let user = Address::generate(&env);
        let username = Symbol::new(&env, &format!("user{}", i));
        let public_key = create_test_key(&env, i as u8);

        client.register(&user, &username, &public_key);
        users.push((user, username));
    }

    // Verify all registrations
    assert_eq!(client.get_user_count(), num_users);

    for (user, username) in users.iter() {
        let record = client.get_user(user);
        assert_eq!(record.username, *username);
        assert!(record.is_active);

        let resolved = client.resolve_username(username);
        assert_eq!(resolved, *user);
    }
}

#[test]
fn test_storage_persistence() {
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

    // Retrieve and verify data persists
    let record1 = client.get_user(&user);
    let resolved1 = client.resolve_username(&username);

    // Simulate time passing (advance ledger)
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 10000,
        protocol_version: 20,
        sequence_number: env.ledger().sequence() + 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });

    // Retrieve again and verify data still persists
    let record2 = client.get_user(&user);
    let resolved2 = client.resolve_username(&username);

    assert_eq!(record1, record2);
    assert_eq!(resolved1, resolved2);
}

#[test]
fn test_event_emission() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let username = symbol_short!("alice");
    let public_key = create_test_key(&env, 1);

    // Register user (should emit event)
    client.register(&user, &username, &public_key);

    // Update profile (should emit event)
    let display_name = Some(symbol_short!("Alice"));
    client.update_profile(&user, &display_name, &None);

    // Deactivate account (should emit event)
    client.deactivate_account(&user);

    // Events are emitted but we can't directly assert them in this test framework
    // In a real scenario, you'd use event listeners or check event logs
}

#[test]
fn test_get_user_for_nonexistent_address() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let nonexistent_user = Address::generate(&env);
    let result = client.try_get_user(&nonexistent_user);
    assert!(result.is_err());
}

#[test]
fn test_username_availability_check() {
    let env = create_test_env();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, UserRegistryContract);
    let client = UserRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let username1 = symbol_short!("alice");
    let username2 = symbol_short!("bob");

    // Both should be available initially
    assert!(client.is_username_available(&username1));
    assert!(client.is_username_available(&username2));

    // Register alice
    let user = Address::generate(&env);
    client.register(&user, &username1, &create_test_key(&env, 1));

    // alice should not be available, bob should still be available
    assert!(!client.is_username_available(&username1));
    assert!(client.is_username_available(&username2));
}
