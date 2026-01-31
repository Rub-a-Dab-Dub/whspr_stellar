use super::*;
use crate::types::{ActionType, InvitationStatus, RateLimitConfig, RoomType};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env, Symbol, Vec,
};

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

    // Try at 30s (should fail, need 50s with scaling)
    env.ledger().with_mut(|li| li.timestamp = 30);
    let res = client.try_reward_message(&user);
    assert!(res.is_err());

    // Try at 51s (should succeed)
    env.ledger().with_mut(|li| li.timestamp = 51);
    let res = client.try_reward_message(&user);
    assert!(res.is_ok());
}

#[test]
fn test_transfer_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Setup Token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    // Mint tokens to user1
    token_admin_client.mint(&user1, &1000);

    // Configure Rate Limits (ensure allow enough for test)
    let config = RateLimitConfig {
        message_cooldown: 0,
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 100,
        daily_tip_limit: 100,
        daily_transfer_limit: 5, // Limit to 5
    };
    client.set_config(&config);

    // 1. Successful Transfer (100 amount)
    client.transfer_tokens(&user1, &user2, &token_id, &100);

    // Check balances (Zero Fee)
    assert_eq!(token.balance(&user1), 900);
    assert_eq!(token.balance(&user2), 100);

    // 2. Rate Limit Test
    // We did 1. Do 4 more.
    client.transfer_tokens(&user1, &user2, &token_id, &10);
    client.transfer_tokens(&user1, &user2, &token_id, &10);
    client.transfer_tokens(&user1, &user2, &token_id, &10);
    client.transfer_tokens(&user1, &user2, &token_id, &10);

    // 6th should fail
    let res = client.try_transfer_tokens(&user1, &user2, &token_id, &10);
    assert!(res.is_err());
}

#[test]
fn test_tip_message_success() {
    let env = Env::default();
    let sender = Address::random(&env);
    let receiver = Address::random(&env);

    // Initialize token and balances
    let token = Address::random(&env);
    // Mint 1000 tokens to sender (pseudo code)
    // token_client.mint(&sender, 1000);

    let tip_id = BaseContract::tip_message(env.clone(), sender.clone(), 1, receiver.clone(), 100).unwrap();
    let tip: Tip = env.storage().instance().get(&DataKey::TipById(tip_id)).unwrap();

    assert_eq!(tip.sender, sender);
    assert_eq!(tip.receiver, receiver);
    assert_eq!(tip.amount, 100);
    assert_eq!(tip.fee, 2); // 2%
}

#[test]
fn test_tip_invalid_amount() {
    let env = Env::default();
    let sender = Address::random(&env);
    let receiver = Address::random(&env);

    let result = BaseContract::tip_message(env.clone(), sender.clone(), 1, receiver.clone(), 0);
    assert!(matches!(result, Err(ContractError::InvalidAmount)));
}

#[test]
fn test_tip_xp_award() {
    let env = Env::default();
    let sender = Address::random(&env);
    let receiver = Address::random(&env);

    let _ = BaseContract::tip_message(env.clone(), sender.clone(), 1, receiver.clone(), 50).unwrap();
    let profile: UserProfile = env.storage().instance().get(&DataKey::User(sender.clone())).unwrap();
    assert!(profile.xp >= 20);
}
  #[test]
    fn test_record_transaction_success() {
        let env = Env::default();
        let sender = Address::random(&env);
        let receiver = Address::random(&env);

        // Example tx hash
        let tx_hash = BytesN::from_array(&env, &[0u8; 32]);

        // Record transaction
        let tx_id = BaseContract::record_transaction(
            env.clone(),
            tx_hash.clone(),
            Symbol::new(&env, "tip"),
            Symbol::new(&env, "success"),
            sender.clone(),
            Some(receiver.clone()),
            Some(100),
        )
        .unwrap();

        // Fetch transaction back
        let stored_tx: Transaction = env
            .storage()
            .instance()
            .get(&DataKey::TransactionById(tx_id))
            .unwrap();

        assert_eq!(stored_tx.id, tx_id);
        assert_eq!(stored_tx.tx_hash, tx_hash);
        assert_eq!(stored_tx.tx_type, Symbol::new(&env, "tip"));
        assert_eq!(stored_tx.status, Symbol::new(&env, "success"));
        assert_eq!(stored_tx.sender, sender);
        assert_eq!(stored_tx.receiver.unwrap(), receiver);
        assert_eq!(stored_tx.amount.unwrap(), 100);
    }

    #[test]
    fn test_transaction_indexing_by_user() {
        let env = Env::default();
        let sender = Address::random(&env);

        let tx_hash = BytesN::from_array(&env, &[1u8; 32]);

        // Record multiple transactions
        BaseContract::record_transaction(
            env.clone(),
            tx_hash.clone(),
            Symbol::new(&env, "message"),
            Symbol::new(&env, "success"),
            sender.clone(),
            None,
            None,
        )
        .unwrap();

        BaseContract::record_transaction(
            env.clone(),
            tx_hash.clone(),
            Symbol::new(&env, "tip"),
            Symbol::new(&env, "success"),
            sender.clone(),
            None,
            Some(50),
        )
        .unwrap();

        // Fetch user transactions
        let user_txs: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::TransactionsByUser(sender.clone()))
            .unwrap();

        assert_eq!(user_txs.len(), 2);
    }

 
    #[test]
    fn test_failed_transaction_logging() {
        let env = Env::default();
        let sender = Address::random(&env);

        let tx_hash = BytesN::from_array(&env, &[3u8; 32]);

        let tx_id = BaseContract::record_transaction(
            env.clone(),
            tx_hash.clone(),
            Symbol::new(&env, "tip"),
            Symbol::new(&env, "failed"), // Mark as failed
            sender.clone(),
            None,
            Some(20),
        )
        .unwrap();

        let tx: Transaction = env
            .storage()
            .instance()
            .get(&DataKey::TransactionById(tx_id))
            .unwrap();

        assert_eq!(tx.status, Symbol::new(&env, "failed"));
        assert_eq!(tx.amount.unwrap(), 20);
    }
      #[test]
    fn test_user_activity_tracking() {
        let env = Env::default();
        let user = Address::random(&env);

        BaseContract::record_user_activity(env.clone(), user.clone(), true);

        let analytics = BaseContract::get_dashboard(env.clone());
        assert_eq!(analytics.total_users, 1);
        assert_eq!(analytics.active_users_daily, 1);
    }

    #[test]
    fn test_message_volume_tracking() {
        let env = Env::default();
        let room = Symbol::new(&env, "general");

        BaseContract::record_message(env.clone(), room.clone());

        let analytics = BaseContract::get_dashboard(env.clone());
        assert_eq!(analytics.total_messages, 1);
    }

    #[test]
    fn test_tip_revenue_tracking() {
        let env = Env::default();
        BaseContract::record_tip(env.clone(), 100, 2);

        let analytics = BaseContract::get_dashboard(env.clone());
        assert_eq!(analytics.total_tips, 1);
        assert_eq!(analytics.total_tip_revenue, 2);
    }

    #[test]
    fn test_room_fee_tracking() {
        let env = Env::default();
        BaseContract::record_room_fee(env.clone(), 50);

        let analytics = BaseContract::get_dashboard(env.clone());
        assert_eq!(analytics.total_room_fees, 50);
    }
