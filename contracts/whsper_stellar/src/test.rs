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
fn test_create_invitation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let invitee = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    // Create a room
    let room_id = client.create_room(&creator, &RoomType::InviteOnly);

    // Create invitation
    env.ledger().with_mut(|li| li.timestamp = 1000);
    let expires_at = 2000;
    let invitation_id = client.create_invitation(&creator, &room_id, &invitee, &expires_at, &None);

    assert_eq!(invitation_id, 1);

    // Verify invitation stored
    let invitations = client.get_user_invitations(&invitee);
    assert_eq!(invitations.len(), 1);
    assert_eq!(invitations.get(0).unwrap().invitee, invitee);
}

#[test]
fn test_accept_invitation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let invitee = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let room_id = client.create_room(&creator, &RoomType::InviteOnly);

    env.ledger().with_mut(|li| li.timestamp = 1000);
    let invitation_id = client.create_invitation(&creator, &room_id, &invitee, &2000, &None);

    // Accept invitation
    client.accept_invitation(&invitee, &invitation_id);

    // Verify user added to room
    let room = client.get_room(&room_id);
    assert!(room.participants.contains(&invitee));

    // Verify use count incremented
    let invitations = client.get_user_invitations(&invitee);
    assert_eq!(invitations.get(0).unwrap().use_count, 1);
}

#[test]
fn test_expired_invitation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let invitee = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let room_id = client.create_room(&creator, &RoomType::InviteOnly);

    env.ledger().with_mut(|li| li.timestamp = 1000);
    let invitation_id = client.create_invitation(&creator, &room_id, &invitee, &2000, &None);

    // Advance time past expiration
    env.ledger().with_mut(|li| li.timestamp = 2001);

    // Should fail
    let res = client.try_accept_invitation(&invitee, &invitation_id);
    assert!(res.is_err());
}

#[test]
fn test_max_uses_invitation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let invitee = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let room_id = client.create_room(&creator, &RoomType::InviteOnly);

    env.ledger().with_mut(|li| li.timestamp = 1000);
    let max_uses = Some(1);
    let invitation_id = client.create_invitation(&creator, &room_id, &invitee, &2000, &max_uses);

    // First accept should succeed
    client.accept_invitation(&invitee, &invitation_id);

    // Second accept should fail
    let res = client.try_accept_invitation(&invitee, &invitation_id);
    assert!(res.is_err());
}

#[test]
fn test_revoke_invitation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let invitee = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let room_id = client.create_room(&creator, &RoomType::InviteOnly);

    env.ledger().with_mut(|li| li.timestamp = 1000);
    let invitation_id = client.create_invitation(&creator, &room_id, &invitee, &2000, &None);

    // Revoke invitation
    client.revoke_invitation(&creator, &invitation_id);

    // Accept should fail
    let res = client.try_accept_invitation(&invitee, &invitation_id);
    assert!(res.is_err());
}

#[test]
fn test_get_room_invitations() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let invitee1 = Address::generate(&env);
    let invitee2 = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let room_id = client.create_room(&creator, &RoomType::InviteOnly);

    env.ledger().with_mut(|li| li.timestamp = 1000);
    client.create_invitation(&creator, &room_id, &invitee1, &2000, &None);
    client.create_invitation(&creator, &room_id, &invitee2, &2000, &None);

    let invitations = client.get_room_invitations(&room_id);
    assert_eq!(invitations.len(), 2);
}

#[test]
fn test_invitation_status() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let invitee = Address::generate(&env);

    let contract_id = env.register_contract(None, BaseContract);
    let client = BaseContractClient::new(&env, &contract_id);

    client.init(&admin, &Symbol::new(&env, "Test"), &1);

    let room_id = client.create_room(&creator, &RoomType::InviteOnly);

    env.ledger().with_mut(|li| li.timestamp = 1000);
    let invitation_id = client.create_invitation(&creator, &room_id, &invitee, &2000, &None);

    // Should be pending
    let status = client.get_invitation_status(&invitation_id);
    assert_eq!(status, InvitationStatus::Pending);

    // Accept
    client.accept_invitation(&invitee, &invitation_id);
    let status = client.get_invitation_status(&invitation_id);
    assert_eq!(status, InvitationStatus::Accepted);
}

