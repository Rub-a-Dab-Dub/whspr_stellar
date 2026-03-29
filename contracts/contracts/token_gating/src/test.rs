#![cfg(test)]

use soroban_sdk::{
    testutils::Address as _,
    Address, BytesN, Env,
};

use crate::{TokenGatingContract, TokenGatingContractClient};

// ============================================================================
// Mock token contract for testing
// ============================================================================

mod mock_token {
    use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

    #[contracttype]
    pub enum DataKey {
        Balance(Address),
    }

    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl MockToken {
        /// Mint (set) token balance for an address (test helper)
        pub fn mint(env: Env, to: Address, amount: i128) {
            env.storage().persistent().set(&DataKey::Balance(to), &amount);
        }

        /// SEP-41 balance function
        pub fn balance(env: Env, id: Address) -> i128 {
            env.storage()
                .persistent()
                .get(&DataKey::Balance(id))
                .unwrap_or(0)
        }
    }
}
use mock_token::MockTokenClient;

// ============================================================================
// Helpers
// ============================================================================

fn make_group_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn setup() -> (Env, TokenGatingContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TokenGatingContract, ());
    let client = TokenGatingContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    (env, client, admin)
}

// ============================================================================
// Unit tests — gating scenarios
// ============================================================================

#[test]
fn test_set_gate_and_get_config() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 1);
    let token_id = env.register(mock_token::MockToken, ());

    client.set_gate(&admin, &group_id, &token_id, &100);

    let config = client.get_gate_config(&group_id).expect("Gate should be set");
    assert_eq!(config.token, token_id);
    assert_eq!(config.min_balance.0, 100);
    assert_eq!(config.admin, admin);
}

#[test]
fn test_verify_access_passes_when_balance_sufficient() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 2);
    let token_id = env.register(mock_token::MockToken, ());
    let token = MockTokenClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token.mint(&user, &500);

    client.set_gate(&admin, &group_id, &token_id, &100);

    assert!(client.verify_access(&group_id, &user));
}

#[test]
fn test_verify_access_fails_when_balance_insufficient() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 3);
    let token_id = env.register(mock_token::MockToken, ());
    let token = MockTokenClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token.mint(&user, &50); // below min_balance of 100

    client.set_gate(&admin, &group_id, &token_id, &100);

    assert!(!client.verify_access(&group_id, &user));
}

#[test]
fn test_verify_access_passes_with_no_gate() {
    let (env, client, _admin) = setup();
    let group_id = make_group_id(&env, 4);
    let user = Address::generate(&env);

    // No gate set — should always pass
    assert!(client.verify_access(&group_id, &user));
}

#[test]
fn test_nft_gating_min_balance_one() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 5);
    let nft_id = env.register(mock_token::MockToken, ());
    let nft = MockTokenClient::new(&env, &nft_id);

    let holder = Address::generate(&env);
    let non_holder = Address::generate(&env);
    nft.mint(&holder, &1);

    client.set_gate(&admin, &group_id, &nft_id, &1);

    assert!(client.verify_access(&group_id, &holder), "NFT holder should pass");
    assert!(!client.verify_access(&group_id, &non_holder), "Non-holder should fail");
}

#[test]
fn test_remove_gate() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 6);
    let token_id = env.register(mock_token::MockToken, ());

    client.set_gate(&admin, &group_id, &token_id, &100);
    assert!(client.get_gate_config(&group_id).is_some());

    client.remove_gate(&admin, &group_id);
    assert!(client.get_gate_config(&group_id).is_none(), "Gate should be removed");

    // After removal, access should be open
    let user = Address::generate(&env);
    assert!(client.verify_access(&group_id, &user));
}

#[test]
fn test_gate_can_be_updated_by_admin() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 7);
    let token1 = env.register(mock_token::MockToken, ());
    let token2 = env.register(mock_token::MockToken, ());

    client.set_gate(&admin, &group_id, &token1, &100);
    client.set_gate(&admin, &group_id, &token2, &200); // update

    let config = client.get_gate_config(&group_id).unwrap();
    assert_eq!(config.token, token2);
    assert_eq!(config.min_balance.0, 200);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // CommonError::InvalidAmount
fn test_set_gate_rejects_zero_min_balance_panics() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 8);
    let token_id = env.register(mock_token::MockToken, ());

    client.set_gate(&admin, &group_id, &token_id, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")] // CommonError::InvalidInput
fn test_remove_gate_fails_when_no_gate_panics() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 9);

    client.remove_gate(&admin, &group_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")] // CommonError::Unauthorized
fn test_remove_gate_fails_when_not_admin_panics() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 10);
    let token_id = env.register(mock_token::MockToken, ());

    client.set_gate(&admin, &group_id, &token_id, &100);

    let imposter = Address::generate(&env);
    client.remove_gate(&imposter, &group_id);
}

#[test]
fn test_re_verification_reflects_balance_change() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 11);
    let token_id = env.register(mock_token::MockToken, ());
    let token = MockTokenClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token.mint(&user, &50); // below threshold

    client.set_gate(&admin, &group_id, &token_id, &100);
    assert!(!client.verify_access(&group_id, &user), "Should fail initially");

    token.mint(&user, &100); // now meets threshold
    assert!(client.verify_access(&group_id, &user), "Should pass after acquiring tokens");
}

// ============================================================================
// Pause / unpause tests (uses gasless-common access_control)
// ============================================================================

#[test]
#[should_panic(expected = "Error(Contract, #3)")] // CommonError::Unauthorized
fn test_pause_blocks_set_gate_panics() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 12);
    let token_id = env.register(mock_token::MockToken, ());

    client.initialize(&admin);
    client.pause(&admin);

    client.set_gate(&admin, &group_id, &token_id, &100);
}

#[test]
fn test_unpause_restores_set_gate() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 13);
    let token_id = env.register(mock_token::MockToken, ());

    client.initialize(&admin);
    client.pause(&admin);
    client.unpause(&admin);

    client.set_gate(&admin, &group_id, &token_id, &100);
    assert!(client.get_gate_config(&group_id).is_some());
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")] // CommonError::Unauthorized
fn test_pause_blocks_verify_access_panics() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 14);
    let user = Address::generate(&env);

    client.initialize(&admin);
    client.pause(&admin);

    client.verify_access(&group_id, &user);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")] // CommonError::Unauthorized
fn test_pause_blocks_remove_gate_panics() {
    let (env, client, admin) = setup();
    let group_id = make_group_id(&env, 15);
    let token_id = env.register(mock_token::MockToken, ());

    client.set_gate(&admin, &group_id, &token_id, &100);

    client.initialize(&admin);
    client.pause(&admin);

    client.remove_gate(&admin, &group_id);
}
