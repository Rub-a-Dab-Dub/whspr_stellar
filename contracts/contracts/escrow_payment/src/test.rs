#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Bytes, BytesN, Env,
};

fn setup() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, EscrowContract);
    EscrowContractClient::new(&env, &contract_id).initialize(&admin);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    (env, contract_id, admin, token_id)
}

fn make_condition(env: &Env, preimage: &[u8]) -> (Bytes, BytesN<32>) {
    let b = Bytes::from_slice(env, preimage);
    let h = env.crypto().sha256(&b);
    (b, h)
}

#[test]
fn test_create_and_release() {
    let (env, contract_id, _admin, token_id) = setup();
    let client = EscrowContractClient::new(&env, &contract_id);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    StellarAssetClient::new(&env, &token_id).mint(&sender, &500);

    let (preimage, hash) = make_condition(&env, b"secret");
    env.ledger().set_timestamp(1000);
    let eid = client.create_escrow(&sender, &recipient, &token_id, &500, &hash, &3600u64);

    client.release_escrow(&eid, &preimage);
    assert_eq!(TokenClient::new(&env, &token_id).balance(&recipient), 500);
}

#[test]
#[should_panic(expected = "TimeoutNotReached")]
fn test_refund_before_timeout_fails() {
    let (env, contract_id, _admin, token_id) = setup();
    let client = EscrowContractClient::new(&env, &contract_id);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    StellarAssetClient::new(&env, &token_id).mint(&sender, &500);

    let (_, hash) = make_condition(&env, b"secret");
    env.ledger().set_timestamp(1000);
    let eid = client.create_escrow(&sender, &recipient, &token_id, &500, &hash, &3600u64);
    client.refund_escrow(&eid);
}

#[test]
fn test_refund_after_timeout() {
    let (env, contract_id, _admin, token_id) = setup();
    let client = EscrowContractClient::new(&env, &contract_id);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    StellarAssetClient::new(&env, &token_id).mint(&sender, &500);

    let (_, hash) = make_condition(&env, b"secret");
    env.ledger().set_timestamp(1000);
    let eid = client.create_escrow(&sender, &recipient, &token_id, &500, &hash, &3600u64);

    env.ledger().set_timestamp(5000); // past timeout
    client.refund_escrow(&eid);
    assert_eq!(TokenClient::new(&env, &token_id).balance(&sender), 500);
}

#[test]
fn test_dispute_and_resolve() {
    let (env, contract_id, admin, token_id) = setup();
    let client = EscrowContractClient::new(&env, &contract_id);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    StellarAssetClient::new(&env, &token_id).mint(&sender, &500);

    let (_, hash) = make_condition(&env, b"secret");
    env.ledger().set_timestamp(1000);
    let eid = client.create_escrow(&sender, &recipient, &token_id, &500, &hash, &3600u64);

    client.dispute_escrow(&sender, &eid);
    client.resolve_dispute(&eid, &300);

    assert_eq!(TokenClient::new(&env, &token_id).balance(&recipient), 300);
    assert_eq!(TokenClient::new(&env, &token_id).balance(&sender), 200);
}

#[test]
#[should_panic(expected = "InvalidCondition")]
fn test_wrong_preimage_rejected() {
    let (env, contract_id, _admin, token_id) = setup();
    let client = EscrowContractClient::new(&env, &contract_id);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    StellarAssetClient::new(&env, &token_id).mint(&sender, &500);

    let (_, hash) = make_condition(&env, b"secret");
    env.ledger().set_timestamp(1000);
    let eid = client.create_escrow(&sender, &recipient, &token_id, &500, &hash, &3600u64);

    let wrong = Bytes::from_slice(&env, b"wrong");
    client.release_escrow(&eid, &wrong);
}
