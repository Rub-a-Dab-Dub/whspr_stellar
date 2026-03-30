#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, Vec,
};

fn setup() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, AirdropContract);
    let client = AirdropContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    StellarAssetClient::new(&env, &token_id).mint(&admin, &1_000_000);

    (env, contract_id, admin, token_id)
}

fn make_leaf(env: &Env, claimer: &Address, amount: i128) -> BytesN<32> {
    use soroban_sdk::Bytes;
    let claimer_bytes = claimer.to_xdr(env);
    let mut leaf_input = Bytes::new(env);
    leaf_input.append(&claimer_bytes);
    leaf_input.append(&Bytes::from_array(env, &amount.to_be_bytes()));
    env.crypto().sha256(&leaf_input)
}

#[test]
fn test_create_and_claim() {
    let (env, contract_id, admin, token_id) = setup();
    let client = AirdropContractClient::new(&env, &contract_id);

    let claimer = Address::generate(&env);
    let amount: i128 = 100;

    // Single-leaf merkle: root == leaf
    let leaf = make_leaf(&env, &claimer, amount);
    let proof: Vec<BytesN<32>> = Vec::new(&env);

    env.ledger().set_timestamp(1000);
    let campaign_id = client.create_campaign(&token_id, &1000, &leaf, &500u64, &2000u64);

    env.ledger().set_timestamp(1000);
    client.claim(&claimer, &campaign_id, &amount, &proof);

    assert!(client.has_claimed(&campaign_id, &claimer));
    let record = client.get_campaign(&campaign_id);
    assert_eq!(record.claimed_amount, amount);
}

#[test]
#[should_panic(expected = "AlreadyClaimed")]
fn test_double_claim_rejected() {
    let (env, contract_id, admin, token_id) = setup();
    let client = AirdropContractClient::new(&env, &contract_id);

    let claimer = Address::generate(&env);
    let amount: i128 = 100;
    let leaf = make_leaf(&env, &claimer, amount);
    let proof: Vec<BytesN<32>> = Vec::new(&env);

    env.ledger().set_timestamp(1000);
    let campaign_id = client.create_campaign(&token_id, &1000, &leaf, &500u64, &2000u64);

    client.claim(&claimer, &campaign_id, &amount, &proof);
    client.claim(&claimer, &campaign_id, &amount, &proof); // should panic
}

#[test]
#[should_panic(expected = "CampaignExpired")]
fn test_expired_campaign_cannot_claim() {
    let (env, contract_id, admin, token_id) = setup();
    let client = AirdropContractClient::new(&env, &contract_id);

    let claimer = Address::generate(&env);
    let amount: i128 = 100;
    let leaf = make_leaf(&env, &claimer, amount);
    let proof: Vec<BytesN<32>> = Vec::new(&env);

    env.ledger().set_timestamp(500);
    let campaign_id = client.create_campaign(&token_id, &1000, &leaf, &100u64, &600u64);

    env.ledger().set_timestamp(700); // after end
    client.claim(&claimer, &campaign_id, &amount, &proof);
}

#[test]
fn test_cancel_returns_unclaimed() {
    let (env, contract_id, admin, token_id) = setup();
    let client = AirdropContractClient::new(&env, &contract_id);

    let leaf = BytesN::from_array(&env, &[1u8; 32]);
    env.ledger().set_timestamp(500);
    let campaign_id = client.create_campaign(&token_id, &1000, &leaf, &100u64, &2000u64);

    let balance_before = TokenClient::new(&env, &token_id).balance(&admin);
    client.cancel_campaign(&campaign_id);
    let balance_after = TokenClient::new(&env, &token_id).balance(&admin);
    assert_eq!(balance_after - balance_before, 1000);

    let record = client.get_campaign(&campaign_id);
    assert!(!record.is_active);
}

#[test]
#[should_panic(expected = "InvalidMerkleProof")]
fn test_invalid_proof_rejected() {
    let (env, contract_id, admin, token_id) = setup();
    let client = AirdropContractClient::new(&env, &contract_id);

    let claimer = Address::generate(&env);
    let leaf = BytesN::from_array(&env, &[1u8; 32]);
    let proof: Vec<BytesN<32>> = Vec::new(&env);

    env.ledger().set_timestamp(500);
    let campaign_id = client.create_campaign(&token_id, &1000, &leaf, &100u64, &2000u64);

    client.claim(&claimer, &campaign_id, &100, &proof);
}
