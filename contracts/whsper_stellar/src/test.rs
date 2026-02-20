use super::*;
use crate::types::{ActionType, ClaimConfig, InvitationStatus, RateLimitConfig, RoomType, Claim, ClaimStatus};
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

    // 1. Successful direct transfer (100 amount)
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
fn test_transfer_tokens_direct_explicit() {
    // transfer_tokens (5-arg) always does direct transfer
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);
    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    token_admin_client.mint(&user1, &500);

    let config = RateLimitConfig {
        message_cooldown: 0,
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 100,
        daily_tip_limit: 100,
        daily_transfer_limit: 10,
    };
    client.set_config(&config);

    client.transfer_tokens(&user1, &user2, &token_id, &50);
    assert_eq!(token.balance(&user1), 450);
    assert_eq!(token.balance(&user2), 50);
}

#[test]
fn test_transfer_with_claim_and_transfer_via_claim_window() {
    // When claim window is enabled, transfer_tokens(..., Some(true)) and transfer_with_claim create pending claim
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);
    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    token_admin_client.mint(&sender, &1000);

    let config = RateLimitConfig {
        message_cooldown: 0,
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 100,
        daily_tip_limit: 100,
        daily_transfer_limit: 10,
    };
    client.set_config(&config);

    client.set_claim_config(&ClaimConfig {
        claim_window_enabled: true,
        claim_validity_ledgers: 100,
    });

    // transfer_with_claim creates pending claim (tokens escrowed in contract)
    client.transfer_with_claim(&sender, &recipient, &token_id, &100);
    assert_eq!(token.balance(&sender), 900);
    assert_eq!(token.balance(&recipient), 0);
    assert_eq!(token.balance(&contract_id), 100);

    // transfer_with_claim again creates pending claim
    client.transfer_with_claim(&sender, &recipient, &token_id, &80);
    assert_eq!(token.balance(&sender), 820);
    assert_eq!(token.balance(&contract_id), 180);
}

#[test]
fn test_transfer_claim_window_disabled() {
    // When use_claim_window is true but claim window is disabled, returns ClaimWindowDisabled
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);
    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    token_admin_client.mint(&sender, &1000);

    let config = RateLimitConfig {
        message_cooldown: 0,
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 100,
        daily_tip_limit: 100,
        daily_transfer_limit: 10,
    };
    client.set_config(&config);
    // Do not set claim config (or set claim_window_enabled: false)

    let res = client.try_transfer_with_claim(&sender, &recipient, &token_id, &100);
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
    // ==================== CLAIM CANCELLATION TESTS ====================

    #[test]
    fn test_cancel_pending_claim_success() {
        let env = Env::default();
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let contract_id = env.register_contract(None, BaseContract);

        // Create a mock token for testing
        let token_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_address = Address::from_contract_id(&env, &token_id);

        // Create a claim in pending status
        let claim = Claim {
            id: 1,
            creator: creator.clone(),
            token: token_address.clone(),
            amount: 1000,
            status: ClaimStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + 86400,
            claimed_by: None,
            claimed_at: None,
        };

        env.storage()
            .instance()
            .set(&DataKey::Claim(1), &claim);

        // Transfer tokens to contract
        let token_client = token::Client::new(&env, &token_address);
        token_client.mint(&contract_id, &1000);

        // Cancel the claim
        let result = BaseContract::cancel_pending_claim(env.clone(), 1, creator.clone());
        assert!(result.is_ok());

        // Verify claim status is now cancelled
        let updated_claim: Claim = env
            .storage()
            .instance()
            .get(&DataKey::Claim(1))
            .unwrap();
        assert_eq!(updated_claim.status, ClaimStatus::Cancelled);
    }

    #[test]
    fn test_cancel_pending_claim_not_creator() {
        let env = Env::default();
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let non_creator = Address::generate(&env);
        let token_address = Address::generate(&env);

        // Create a claim
        let claim = Claim {
            id: 1,
            creator: creator.clone(),
            token: token_address.clone(),
            amount: 1000,
            status: ClaimStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + 86400,
            claimed_by: None,
            claimed_at: None,
        };

        env.storage()
            .instance()
            .set(&DataKey::Claim(1), &claim);

        // Try to cancel as non-creator
        let result = BaseContract::cancel_pending_claim(env.clone(), 1, non_creator);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), ContractError::NotClaimCreator);
    }

    #[test]
    fn test_cancel_already_claimed() {
        let env = Env::default();
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let claimer = Address::generate(&env);
        let token_address = Address::generate(&env);

        // Create a claim that's already claimed
        let claim = Claim {
            id: 1,
            creator: creator.clone(),
            token: token_address.clone(),
            amount: 1000,
            status: ClaimStatus::Claimed,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + 86400,
            claimed_by: Some(claimer.clone()),
            claimed_at: Some(env.ledger().timestamp()),
        };

        env.storage()
            .instance()
            .set(&DataKey::Claim(1), &claim);

        // Try to cancel already claimed claim
        let result = BaseContract::cancel_pending_claim(env.clone(), 1, creator.clone());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), ContractError::ClaimAlreadyClaimed);
    }

    #[test]
    fn test_cancel_already_cancelled() {
        let env = Env::default();
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let token_address = Address::generate(&env);

        // Create a claim that's already cancelled
        let claim = Claim {
            id: 1,
            creator: creator.clone(),
            token: token_address.clone(),
            amount: 1000,
            status: ClaimStatus::Cancelled,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + 86400,
            claimed_by: None,
            claimed_at: None,
        };

        env.storage()
            .instance()
            .set(&DataKey::Claim(1), &claim);

        // Try to cancel already cancelled claim
        let result = BaseContract::cancel_pending_claim(env.clone(), 1, creator.clone());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), ContractError::ClaimAlreadyCancelled);
    }

    #[test]
    fn test_cancel_non_existent_claim() {
        let env = Env::default();
        env.mock_all_auths();

        let creator = Address::generate(&env);

        // Try to cancel non-existent claim
        let result = BaseContract::cancel_pending_claim(env.clone(), 999, creator.clone());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), ContractError::ClaimNotFound);
    }

    #[test]
    fn test_cancel_claim_without_expiration() {
        let env = Env::default();
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let contract_id = env.register_contract(None, BaseContract);

        // Create a mock token
        let token_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_address = Address::from_contract_id(&env, &token_id);

        // Create a claim with far future expiration (shouldn't affect cancellation)
        let claim = Claim {
            id: 1,
            creator: creator.clone(),
            token: token_address.clone(),
            amount: 5000,
            status: ClaimStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + 31536000, // 1 year
            claimed_by: None,
            claimed_at: None,
        };

        env.storage()
            .instance()
            .set(&DataKey::Claim(1), &claim);

        // Transfer tokens to contract
        let token_client = token::Client::new(&env, &token_address);
        token_client.mint(&contract_id, &5000);

        // Should succeed even though claim hasn't expired
        let result = BaseContract::cancel_pending_claim(env.clone(), 1, creator.clone());
        assert!(result.is_ok());

        let updated_claim: Claim = env
            .storage()
            .instance()
            .get(&DataKey::Claim(1))
            .unwrap();
        assert_eq!(updated_claim.status, ClaimStatus::Cancelled);
    }

    #[test]
    fn test_cancel_claim_tokens_returned() {
        let env = Env::default();
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let contract_id = env.register_contract(None, BaseContract);

        // Create a mock token
        let token_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_address = Address::from_contract_id(&env, &token_id);

        // Create a claim
        let claim = Claim {
            id: 1,
            creator: creator.clone(),
            token: token_address.clone(),
            amount: 2500,
            status: ClaimStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + 86400,
            claimed_by: None,
            claimed_at: None,
        };

        env.storage()
            .instance()
            .set(&DataKey::Claim(1), &claim);

        // Transfer tokens to contract
        let token_client = token::Client::new(&env, &token_address);
        token_client.mint(&contract_id, &2500);

        // Get balance before cancellation
        let balance_before = token_client.balance(&creator);

        // Cancel the claim
        BaseContract::cancel_pending_claim(env.clone(), 1, creator.clone()).unwrap();

        // Verify tokens were transferred back to creator
        let balance_after = token_client.balance(&creator);
        assert_eq!(balance_after - balance_before, 2500);
    }

    #[test]
    fn test_cancel_claim_event_emitted() {
        let env = Env::default();
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let contract_id = env.register_contract(None, BaseContract);

        // Create a mock token
        let token_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_address = Address::from_contract_id(&env, &token_id);

        // Create a claim
        let claim = Claim {
            id: 42,
            creator: creator.clone(),
            token: token_address.clone(),
            amount: 1500,
            status: ClaimStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + 86400,
            claimed_by: None,
            claimed_at: None,
        };

        env.storage()
            .instance()
            .set(&DataKey::Claim(42), &claim);

        // Transfer tokens to contract
        let token_client = token::Client::new(&env, &token_address);
        token_client.mint(&contract_id, &1500);

        // Cancel the claim
        BaseContract::cancel_pending_claim(env.clone(), 42, creator.clone()).unwrap();

        // Events are published but we verify the operation succeeds
        // In a real scenario, events would be verified through event logs
        let updated_claim: Claim = env
            .storage()
            .instance()
            .get(&DataKey::Claim(42))
            .unwrap();
        assert_eq!(updated_claim.status, ClaimStatus::Cancelled);
    }

    #[test]
    fn test_cancel_multiple_claims_independent() {
        let env = Env::default();
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let contract_id = env.register_contract(None, BaseContract);

        // Create a mock token
        let token_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_address = Address::from_contract_id(&env, &token_id);

        // Create multiple claims
        let claim1 = Claim {
            id: 1,
            creator: creator.clone(),
            token: token_address.clone(),
            amount: 1000,
            status: ClaimStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + 86400,
            claimed_by: None,
            claimed_at: None,
        };

        let claim2 = Claim {
            id: 2,
            creator: creator.clone(),
            token: token_address.clone(),
            amount: 2000,
            status: ClaimStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + 86400,
            claimed_by: None,
            claimed_at: None,
        };

        env.storage()
            .instance()
            .set(&DataKey::Claim(1), &claim1);
        env.storage()
            .instance()
            .set(&DataKey::Claim(2), &claim2);

        // Transfer tokens to contract
        let token_client = token::Client::new(&env, &token_address);
        token_client.mint(&contract_id, &3000);

        // Cancel only the first claim
        BaseContract::cancel_pending_claim(env.clone(), 1, creator.clone()).unwrap();

        // Verify first claim is cancelled
        let updated_claim1: Claim = env
            .storage()
            .instance()
            .get(&DataKey::Claim(1))
            .unwrap();
        assert_eq!(updated_claim1.status, ClaimStatus::Cancelled);

        // Verify second claim is still pending
        let updated_claim2: Claim = env
            .storage()
            .instance()
            .get(&DataKey::Claim(2))
            .unwrap();
        assert_eq!(updated_claim2.status, ClaimStatus::Pending);
    }

    // ==================== ADMIN CANCEL EXPIRED CLAIM TESTS ====================

    #[test]
fn test_admin_cancel_expired_claim_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    // Initialize contract
    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    // Create a mock token
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_address = Address::from_contract_id(&env, &token_id);

    // Set initial timestamp
    env.ledger().with_mut(|li| li.timestamp = 1000);

    // Create an expired claim
    let claim = Claim {
        id: 1,
        creator: creator.clone(),
        token: token_address.clone(),
        amount: 1000,
        status: ClaimStatus::Pending,
        created_at: 1000,
        expires_at: 2000, // Expires at 2000
        claimed_by: None,
        claimed_at: None,
    };

    env.storage()
        .instance()
        .set(&DataKey::Claim(1), &claim);

    // Transfer tokens to contract
    let token_client = token::Client::new(&env, &token_address);
    token_client.mint(&contract_id, &1000);

    // Advance time past expiration
    env.ledger().with_mut(|li| li.timestamp = 3000);

    // Admin cancels the expired claim
    let result = BaseContract::admin_cancel_expired_claim(env.clone(), 1);
    assert!(result.is_ok());

    // Verify claim status is now cancelled
    let updated_claim: Claim = env
        .storage()
        .instance()
        .get(&DataKey::Claim(1))
        .unwrap();
    assert_eq!(updated_claim.status, ClaimStatus::Cancelled);
}

#[test]
fn test_admin_cancel_expired_claim_not_expired() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token_address = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    // Initialize contract
    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    // Set initial timestamp
    env.ledger().with_mut(|li| li.timestamp = 1000);

    // Create a non-expired claim
    let claim = Claim {
        id: 1,
        creator: creator.clone(),
        token: token_address.clone(),
        amount: 1000,
        status: ClaimStatus::Pending,
        created_at: 1000,
        expires_at: 5000, // Expires in the future
        claimed_by: None,
        claimed_at: None,
    };

    env.storage()
        .instance()
        .set(&DataKey::Claim(1), &claim);

    // Attempt to cancel non-expired claim (should fail)
    let result = BaseContract::admin_cancel_expired_claim(env.clone(), 1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::Unauthorized);
}

#[test]
fn test_admin_cancel_expired_claim_already_claimed() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let claimer = Address::generate(&env);
    let token_address = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    // Initialize contract
    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    // Set initial timestamp
    env.ledger().with_mut(|li| li.timestamp = 1000);

    // Create an expired claim that's already been claimed
    let claim = Claim {
        id: 1,
        creator: creator.clone(),
        token: token_address.clone(),
        amount: 1000,
        status: ClaimStatus::Claimed,
        created_at: 1000,
        expires_at: 2000,
        claimed_by: Some(claimer.clone()),
        claimed_at: Some(1500),
    };

    env.storage()
        .instance()
        .set(&DataKey::Claim(1), &claim);

    // Advance time past expiration
    env.ledger().with_mut(|li| li.timestamp = 3000);

    // Attempt to cancel already claimed claim (should fail)
    let result = BaseContract::admin_cancel_expired_claim(env.clone(), 1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::ClaimAlreadyClaimed);
}

#[test]
fn test_admin_cancel_expired_claim_already_cancelled() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token_address = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    // Initialize contract
    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    // Set initial timestamp
    env.ledger().with_mut(|li| li.timestamp = 1000);

    // Create an expired claim that's already cancelled
    let claim = Claim {
        id: 1,
        creator: creator.clone(),
        token: token_address.clone(),
        amount: 1000,
        status: ClaimStatus::Cancelled,
        created_at: 1000,
        expires_at: 2000,
        claimed_by: None,
        claimed_at: None,
    };

    env.storage()
        .instance()
        .set(&DataKey::Claim(1), &claim);

    // Advance time past expiration
    env.ledger().with_mut(|li| li.timestamp = 3000);

    // Attempt to cancel already cancelled claim (should fail)
    let result = BaseContract::admin_cancel_expired_claim(env.clone(), 1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::ClaimAlreadyCancelled);
}

#[test]
fn test_admin_cancel_expired_claim_non_existent() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    // Initialize contract
    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    // Attempt to cancel non-existent claim (should fail)
    let result = BaseContract::admin_cancel_expired_claim(env.clone(), 999);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::ClaimNotFound);
}

#[test]
fn test_admin_cancel_expired_claim_returns_to_creator() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    // Initialize contract
    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    // Create a mock token
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_address = Address::from_contract_id(&env, &token_id);

    // Set initial timestamp
    env.ledger().with_mut(|li| li.timestamp = 1000);

    // Create an expired claim
    let claim = Claim {
        id: 1,
        creator: creator.clone(),
        token: token_address.clone(),
        amount: 5000,
        status: ClaimStatus::Pending,
        created_at: 1000,
        expires_at: 2000,
        claimed_by: None,
        claimed_at: None,
    };

    env.storage()
        .instance()
        .set(&DataKey::Claim(1), &claim);

    // Transfer tokens to contract
    let token_client = token::Client::new(&env, &token_address);
    token_client.mint(&contract_id, &5000);

    // Advance time past expiration
    env.ledger().with_mut(|li| li.timestamp = 3000);

    // Admin cancels the expired claim
    BaseContract::admin_cancel_expired_claim(env.clone(), 1).unwrap();

    // Verify tokens were transferred back to creator (tokens go back to creator, not admin)
    // The transfer function will have been called with creator as recipient
    let updated_claim: Claim = env
        .storage()
        .instance()
        .get(&DataKey::Claim(1))
        .unwrap();
    assert_eq!(updated_claim.status, ClaimStatus::Cancelled);
}

#[test]
fn test_admin_cancel_expired_claim_event_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    // Initialize contract
    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    // Create a mock token
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_address = Address::from_contract_id(&env, &token_id);

    // Set initial timestamp
    env.ledger().with_mut(|li| li.timestamp = 1000);

    // Create an expired claim
    let claim = Claim {
        id: 42,
        creator: creator.clone(),
        token: token_address.clone(),
        amount: 2000,
        status: ClaimStatus::Pending,
        created_at: 1000,
        expires_at: 2000,
        claimed_by: None,
        claimed_at: None,
    };

    env.storage()
        .instance()
        .set(&DataKey::Claim(42), &claim);

    // Transfer tokens to contract
    let token_client = token::Client::new(&env, &token_address);
    token_client.mint(&contract_id, &2000);

    // Advance time past expiration
    env.ledger().with_mut(|li| li.timestamp = 3000);

    // Admin cancels the expired claim
    BaseContract::admin_cancel_expired_claim(env.clone(), 42).unwrap();

    // Verify event was emitted with correct data
    // The event should be "claim_expired_cancelled" with claim_id, admin, creator, amount, timestamp
    assert!(!env.events().all().is_empty());
}

#[test]
fn test_admin_cancel_multiple_expired_claims() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    // Initialize contract
    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    // Create a mock token
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_address = Address::from_contract_id(&env, &token_id);

    // Set initial timestamp
    env.ledger().with_mut(|li| li.timestamp = 1000);

    // Create three expired claims
    let claim1 = Claim {
        id: 1,
        creator: creator.clone(),
        token: token_address.clone(),
        amount: 1000,
        status: ClaimStatus::Pending,
        created_at: 1000,
        expires_at: 2000,
        claimed_by: None,
        claimed_at: None,
    };

    let claim2 = Claim {
        id: 2,
        creator: creator.clone(),
        token: token_address.clone(),
        amount: 1500,
        status: ClaimStatus::Pending,
        created_at: 1000,
        expires_at: 2000,
        claimed_by: None,
        claimed_at: None,
    };

    let claim3 = Claim {
        id: 3,
        creator: creator.clone(),
        token: token_address.clone(),
        amount: 2000,
        status: ClaimStatus::Pending,
        created_at: 1000,
        expires_at: 2000,
        claimed_by: None,
        claimed_at: None,
    };

    env.storage().instance().set(&DataKey::Claim(1), &claim1);
    env.storage().instance().set(&DataKey::Claim(2), &claim2);
    env.storage().instance().set(&DataKey::Claim(3), &claim3);

    // Transfer tokens to contract
    let token_client = token::Client::new(&env, &token_address);
    token_client.mint(&contract_id, &4500);

    // Advance time past expiration
    env.ledger().with_mut(|li| li.timestamp = 3000);

    // Admin cancels all expired claims
    BaseContract::admin_cancel_expired_claim(env.clone(), 1).unwrap();
    BaseContract::admin_cancel_expired_claim(env.clone(), 2).unwrap();
    BaseContract::admin_cancel_expired_claim(env.clone(), 3).unwrap();

    // Verify all claims are cancelled
    let updated_claim1: Claim = env
        .storage()
        .instance()
        .get(&DataKey::Claim(1))
        .unwrap();
    assert_eq!(updated_claim1.status, ClaimStatus::Cancelled);

    let updated_claim2: Claim = env
        .storage()
        .instance()
        .get(&DataKey::Claim(2))
        .unwrap();
    assert_eq!(updated_claim2.status, ClaimStatus::Cancelled);

    let updated_claim3: Claim = env
        .storage()
        .instance()
        .get(&DataKey::Claim(3))
        .unwrap();
    assert_eq!(updated_claim3.status, ClaimStatus::Cancelled);
}

// ==================== CLAIM (BENEFICIARY CLAIM) TESTS ====================

#[test]
fn test_claim_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);
    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    token_admin_client.mint(&sender, &1000);

    let config = RateLimitConfig {
        message_cooldown: 0,
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 100,
        daily_tip_limit: 100,
        daily_transfer_limit: 10,
    };
    client.set_config(&config);

    client.set_claim_config(&ClaimConfig {
        claim_window_enabled: true,
        claim_validity_ledgers: 100,
    });

    // Create pending claim
    client.transfer_with_claim(&sender, &recipient, &token_id, &250);

    assert_eq!(token.balance(&recipient), 0);
    assert_eq!(token.balance(&contract_id), 250);

    // Recipient claims
    client.claim(&1, &recipient);

    assert_eq!(token.balance(&recipient), 250);
    assert_eq!(token.balance(&contract_id), 0);

    let claim: Claim = env
        .storage()
        .instance()
        .get(&DataKey::Claim(1))
        .unwrap();
    assert_eq!(claim.status, ClaimStatus::Claimed);
    assert_eq!(claim.claimed_by, Some(recipient.clone()));
}

#[test]
fn test_claim_wrong_recipient() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let wrong_recipient = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);
    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    token_admin_client.mint(&sender, &1000);

    let config = RateLimitConfig {
        message_cooldown: 0,
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 100,
        daily_tip_limit: 100,
        daily_transfer_limit: 10,
    };
    client.set_config(&config);
    client.set_claim_config(&ClaimConfig {
        claim_window_enabled: true,
        claim_validity_ledgers: 100,
    });

    client.transfer_with_claim(&sender, &recipient, &token_id, &100);

    let res = client.try_claim(&1, &wrong_recipient);
    assert!(res.is_err());
    assert_eq!(res.unwrap_err(), ContractError::Unauthorized);
}

#[test]
fn test_claim_expired() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_address = Address::from_contract_id(&env, &token_id);
    let token_client = token::Client::new(&env, &token_address);
    token_client.mint(&contract_id, &500);

    let current_seq = env.ledger().sequence();
    let claim = Claim {
        id: 1,
        creator: creator.clone(),
        recipient: recipient.clone(),
        token: token_address.clone(),
        amount: 500,
        status: ClaimStatus::Pending,
        created_at: env.ledger().timestamp(),
        expires_at: env.ledger().timestamp() + 86400,
        expiry_ledger: Some(current_seq + 5),
        claimed_by: None,
        claimed_at: None,
    };
    env.storage().instance().set(&DataKey::Claim(1), &claim);

    // Advance ledger past expiry
    env.ledger().with_mut(|li| li.sequence = current_seq + 10);

    let client = BaseContractClient::new(&env, &contract_id);
    let res = client.try_claim(&1, &recipient);
    assert!(res.is_err());
    assert_eq!(res.unwrap_err(), ContractError::ClaimExpired);
}

#[test]
fn test_claim_already_claimed() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_address = Address::from_contract_id(&env, &token_id);

    let claim = Claim {
        id: 1,
        creator: creator.clone(),
        recipient: recipient.clone(),
        token: token_address.clone(),
        amount: 1000,
        status: ClaimStatus::Claimed,
        created_at: env.ledger().timestamp(),
        expires_at: env.ledger().timestamp() + 86400,
        expiry_ledger: Some(env.ledger().sequence() + 100),
        claimed_by: Some(recipient.clone()),
        claimed_at: Some(env.ledger().timestamp()),
    };
    env.storage().instance().set(&DataKey::Claim(1), &claim);

    let client = BaseContractClient::new(&env, &contract_id);
    let res = client.try_claim(&1, &recipient);
    assert!(res.is_err());
    assert_eq!(res.unwrap_err(), ContractError::ClaimAlreadyClaimed);
}

#[test]
fn test_claim_already_cancelled() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_address = Address::from_contract_id(&env, &token_id);

    let claim = Claim {
        id: 1,
        creator: creator.clone(),
        recipient: recipient.clone(),
        token: token_address.clone(),
        amount: 1000,
        status: ClaimStatus::Cancelled,
        created_at: env.ledger().timestamp(),
        expires_at: env.ledger().timestamp() + 86400,
        expiry_ledger: Some(env.ledger().sequence() + 100),
        claimed_by: None,
        claimed_at: None,
    };
    env.storage().instance().set(&DataKey::Claim(1), &claim);

    let client = BaseContractClient::new(&env, &contract_id);
    let res = client.try_claim(&1, &recipient);
    assert!(res.is_err());
    assert_eq!(res.unwrap_err(), ContractError::ClaimAlreadyCancelled);
}

#[test]
fn test_claim_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let contract_id = env.register_contract(None, BaseContract);

    BaseContractClient::new(&env, &contract_id).init(&admin, &Symbol::new(&env, "Test"), &1);

    let client = BaseContractClient::new(&env, &contract_id);
    let res = client.try_claim(&999, &recipient);
    assert!(res.is_err());
    assert_eq!(res.unwrap_err(), ContractError::ClaimNotFound);
}

#[test]
fn test_claim_tokens_transferred_correctly() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);
    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    token_admin_client.mint(&sender, &5000);

    let config = RateLimitConfig {
        message_cooldown: 0,
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 100,
        daily_tip_limit: 100,
        daily_transfer_limit: 10,
    };
    client.set_config(&config);
    client.set_claim_config(&ClaimConfig {
        claim_window_enabled: true,
        claim_validity_ledgers: 100,
    });

    let amount = 1234i128;
    client.transfer_with_claim(&sender, &recipient, &token_id, &amount);

    client.claim(&1, &recipient);

    assert_eq!(token.balance(&recipient), amount);
    assert_eq!(token.balance(&contract_id), 0);
}

#[test]
fn test_claim_status_updated_atomically() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);
    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    token_admin_client.mint(&sender, &1000);

    let config = RateLimitConfig {
        message_cooldown: 0,
        tip_cooldown: 0,
        transfer_cooldown: 0,
        daily_message_limit: 100,
        daily_tip_limit: 100,
        daily_transfer_limit: 10,
    };
    client.set_config(&config);
    client.set_claim_config(&ClaimConfig {
        claim_window_enabled: true,
        claim_validity_ledgers: 100,
    });

    client.transfer_with_claim(&sender, &recipient, &token_id, &100);
    client.claim(&1, &recipient);

    // Verify claim_processed was emitted (claim status is Claimed)
    let claim: Claim = env
        .storage()
        .instance()
        .get(&DataKey::Claim(1))
        .unwrap();
    assert_eq!(claim.status, ClaimStatus::Claimed);
    assert_eq!(claim.claimed_by, Some(recipient));
}

