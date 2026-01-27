#![cfg(test)]

use super::*;
use soroban_sdk::{
    Env, 
    testutils::{
        Address as _, 
        Ledger as _, 
    }, 
    Address, 
    Symbol,
    Vec,
};
use crate::types::{RateLimitConfig, ActionType};



#[test]
fn test_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    
    // contract implementation
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);
}

#[test]
fn test_cooldown() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Set timestamp to 0
    // If set_timestamp doesn't exist on Ledger testutils in this version, use with_mut
    env.ledger().with_mut(|li| li.timestamp = 0);

    // First message should succeed
    client.reward_message(&user);

    // Immediate second message should fail (default cooldown 60s)
    let res = client.try_reward_message(&user);
    assert!(res.is_err());

    // Advance time by 61 seconds
    env.ledger().with_mut(|li| li.timestamp = 61);

    // Should succeed now
    let res = client.try_reward_message(&user);
    assert!(res.is_ok());
}

#[test]
fn test_daily_limit() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Set a small daily limit for testing
    let config = RateLimitConfig {
        message_cooldown: 0, 
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 2,
        daily_tip_limit: 10,
        daily_transfer_limit: 10,
    };
    client.set_config(&config);

    // Send 2 messages (should succeed)
    client.reward_message(&user);
    client.reward_message(&user);

    // 3rd message should fail
    let res = client.try_reward_message(&user);
    assert!(res.is_err());

    // Advance to next day (86400 seconds)
    env.ledger().with_mut(|li| li.timestamp = 86401);

    // Should succeed again
    let res = client.try_reward_message(&user);
    assert!(res.is_ok());
}

#[test]
fn test_admin_override() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Set limit to 0
    let config = RateLimitConfig {
        message_cooldown: 0,
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 0,
        daily_tip_limit: 0,
        daily_transfer_limit: 0,
    };
    client.set_config(&config);

    // Should fail
    let res = client.try_reward_message(&user);
    assert!(res.is_err());

    // Enable override
    client.set_override(&user, &true);

    // Should succeed
    let res = client.try_reward_message(&user);
    assert!(res.is_ok());
}

#[test]
fn test_reputation_scaling() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Set config: Cooldown 100s
    let config = RateLimitConfig {
        message_cooldown: 100,
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 100,
        daily_tip_limit: 100,
        daily_transfer_limit: 100,
    };
    client.set_config(&config);

    // Set Reputation to 100
    client.set_reputation(&user, &100);

    env.ledger().with_mut(|li| li.timestamp = 0);
    client.reward_message(&user);

    // Try at 30s (should fail, need 50s)
    env.ledger().with_mut(|li| li.timestamp = 30);
    let res = client.try_reward_message(&user);
    assert!(res.is_err());

    // Try at 51s (should succeed)
    env.ledger().with_mut(|li| li.timestamp = 51);
    let res = client.try_reward_message(&user);
    assert!(res.is_ok());
}
