#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env, String, Symbol,
};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> (Address, token::Client<'a>, token::StellarAssetClient<'a>) {
    let token_address = env.register_stellar_asset_contract_v2(admin.clone());
    let token_client = token::Client::new(env, &token_address);
    let token_admin = token::StellarAssetClient::new(env, &token_address);
    (token_address, token_client, token_admin)
}

#[test]
fn test_register_token() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    // Initialize contract
    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Create a test token
    let (token_address, _token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&admin, &1_000_000);

    // Register the token
    let result = client.register_token(
        &token_address,
        &Symbol::new(&env, "TST"),
        &String::from_str(&env, "Test Token"),
        &7,
    );
    assert!(result.is_ok());

    // Verify token is registered
    let metadata = client.get_token_metadata(&token_address);
    assert_eq!(metadata.symbol, Symbol::new(&env, "TST"));
    assert_eq!(metadata.decimals, 7);
    assert!(metadata.is_whitelisted);
    assert!(!metadata.is_blacklisted);
}

#[test]
fn test_register_token_duplicate() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let (token_address, _token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&admin, &1_000_000);

    // Register token first time
    client.register_token(
        &token_address,
        &Symbol::new(&env, "TST"),
        &String::from_str(&env, "Test Token"),
        &7,
    );

    // Try to register again - should fail
    let result = client.try_register_token(
        &token_address,
        &Symbol::new(&env, "TST"),
        &String::from_str(&env, "Test Token"),
        &7,
    );
    assert!(result.is_err());
}

#[test]
fn test_transfer_token() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Create and register token
    let (token_address, token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&user1, &1_000_000);

    client.register_token(
        &token_address,
        &Symbol::new(&env, "TST"),
        &String::from_str(&env, "Test Token"),
        &7,
    );

    // Transfer tokens
    let conversation_id = BytesN::from_array(&env, &[1u8; 32]);
    let result = client.transfer_token(
        &token_address,
        &user1,
        &user2,
        &100_000,
        &conversation_id,
    );
    assert!(result.is_ok());

    // Verify balances
    let balance1 = token_client.balance(&user1);
    let balance2 = token_client.balance(&user2);
    assert_eq!(balance1, 900_000);
    assert_eq!(balance2, 100_000);
}

#[test]
fn test_transfer_unregistered_token() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Create token but don't register it
    let (token_address, _token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&user1, &1_000_000);

    // Try to transfer unregistered token - should fail
    let conversation_id = BytesN::from_array(&env, &[1u8; 32]);
    let result = client.try_transfer_token(
        &token_address,
        &user1,
        &user2,
        &100_000,
        &conversation_id,
    );
    assert!(result.is_err());
}

#[test]
fn test_transfer_blacklisted_token() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Create and register token
    let (token_address, _token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&user1, &1_000_000);

    client.register_token(
        &token_address,
        &Symbol::new(&env, "TST"),
        &String::from_str(&env, "Test Token"),
        &7,
    );

    // Blacklist the token
    client.blacklist_token(&token_address);

    // Try to transfer blacklisted token - should fail
    let conversation_id = BytesN::from_array(&env, &[1u8; 32]);
    let result = client.try_transfer_token(
        &token_address,
        &user1,
        &user2,
        &100_000,
        &conversation_id,
    );
    assert!(result.is_err());
}

#[test]
fn test_get_supported_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Register multiple tokens
    let (token1, _tc1, ta1) = create_token_contract(&env, &admin);
    ta1.mint(&admin, &1_000_000);
    client.register_token(
        &token1,
        &Symbol::new(&env, "TST1"),
        &String::from_str(&env, "Test Token 1"),
        &7,
    );

    let (token2, _tc2, ta2) = create_token_contract(&env, &admin);
    ta2.mint(&admin, &1_000_000);
    client.register_token(
        &token2,
        &Symbol::new(&env, "TST2"),
        &String::from_str(&env, "Test Token 2"),
        &7,
    );

    // Get supported tokens
    let tokens = client.get_supported_tokens();
    assert_eq!(tokens.len(), 2);
}

#[test]
fn test_get_supported_tokens_excludes_blacklisted() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Register two tokens
    let (token1, _tc1, ta1) = create_token_contract(&env, &admin);
    ta1.mint(&admin, &1_000_000);
    client.register_token(
        &token1,
        &Symbol::new(&env, "TST1"),
        &String::from_str(&env, "Test Token 1"),
        &7,
    );

    let (token2, _tc2, ta2) = create_token_contract(&env, &admin);
    ta2.mint(&admin, &1_000_000);
    client.register_token(
        &token2,
        &Symbol::new(&env, "TST2"),
        &String::from_str(&env, "Test Token 2"),
        &7,
    );

    // Blacklist one token
    client.blacklist_token(&token1);

    // Get supported tokens - should only return non-blacklisted
    let tokens = client.get_supported_tokens();
    assert_eq!(tokens.len(), 1);
    assert_eq!(tokens.get(0).unwrap().symbol, Symbol::new(&env, "TST2"));
}

#[test]
fn test_whitelist_management() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let (token_address, _token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&admin, &1_000_000);

    client.register_token(
        &token_address,
        &Symbol::new(&env, "TST"),
        &String::from_str(&env, "Test Token"),
        &7,
    );

    // Token should be whitelisted by default
    assert!(client.is_token_whitelisted(&token_address));

    // Remove from whitelist
    client.remove_from_whitelist(&token_address);
    assert!(!client.is_token_whitelisted(&token_address));

    // Add back to whitelist
    client.whitelist_token(&token_address);
    assert!(client.is_token_whitelisted(&token_address));
}

#[test]
fn test_blacklist_management() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let (token_address, _token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&admin, &1_000_000);

    client.register_token(
        &token_address,
        &Symbol::new(&env, "TST"),
        &String::from_str(&env, "Test Token"),
        &7,
    );

    // Token should not be blacklisted by default
    assert!(!client.is_token_blacklisted(&token_address));

    // Blacklist token
    client.blacklist_token(&token_address);
    assert!(client.is_token_blacklisted(&token_address));

    // Remove from blacklist
    client.remove_from_blacklist(&token_address);
    assert!(!client.is_token_blacklisted(&token_address));
}

#[test]
fn test_get_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let (token_address, _token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&user, &500_000);

    // Query balance
    let balance = client.get_balance(&token_address, &user);
    assert_eq!(balance, 500_000);
}

#[test]
fn test_multi_token_transfers() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Create and register two different tokens
    let (token1, tc1, ta1) = create_token_contract(&env, &admin);
    ta1.mint(&user1, &1_000_000);
    client.register_token(
        &token1,
        &Symbol::new(&env, "TST1"),
        &String::from_str(&env, "Test Token 1"),
        &7,
    );

    let (token2, tc2, ta2) = create_token_contract(&env, &admin);
    ta2.mint(&user1, &2_000_000);
    client.register_token(
        &token2,
        &Symbol::new(&env, "TST2"),
        &String::from_str(&env, "Test Token 2"),
        &7,
    );

    // Transfer both tokens
    let conversation_id = BytesN::from_array(&env, &[1u8; 32]);
    
    client.transfer_token(&token1, &user1, &user2, &100_000, &conversation_id);
    client.transfer_token(&token2, &user1, &user2, &200_000, &conversation_id);

    // Verify balances for both tokens
    assert_eq!(tc1.balance(&user1), 900_000);
    assert_eq!(tc1.balance(&user2), 100_000);
    assert_eq!(tc2.balance(&user1), 1_800_000);
    assert_eq!(tc2.balance(&user2), 200_000);
}

#[test]
fn test_rate_limiting_applies_to_token_transfers() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Set strict rate limits
    let config = RateLimitConfig {
        message_cooldown: 0,
        tip_cooldown: 0,
        transfer_cooldown: 60, // 60 second cooldown
        daily_message_limit: 100,
        daily_tip_limit: 50,
        daily_transfer_limit: 20,
    };
    client.set_config(&config);

    let (token_address, _token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&user1, &1_000_000);
    client.register_token(
        &token_address,
        &Symbol::new(&env, "TST"),
        &String::from_str(&env, "Test Token"),
        &7,
    );

    // First transfer should succeed
    let conversation_id = BytesN::from_array(&env, &[1u8; 32]);
    let result = client.transfer_token(&token_address, &user1, &user2, &100_000, &conversation_id);
    assert!(result.is_ok());

    // Immediate second transfer should fail due to cooldown
    let result = client.try_transfer_token(&token_address, &user1, &user2, &100_000, &conversation_id);
    assert!(result.is_err());

    // Advance time past cooldown
    env.ledger().with_mut(|li| li.timestamp = 61);

    // Transfer should now succeed
    let result = client.transfer_token(&token_address, &user1, &user2, &100_000, &conversation_id);
    assert!(result.is_ok());
}
