#![allow(deprecated)]

use crate::{
    BridgeAdapterContract, BridgeAdapterContractClient, ContractError, DepositStatus,
    REFUND_TIMEOUT_SECS,
};
use soroban_sdk::{
    testutils::Address as _,
    token, Address, Bytes, Env,
};

fn deploy<'a>(env: &'a Env) -> (Address, BridgeAdapterContractClient<'a>) {
    let id = env.register_contract(None, BridgeAdapterContract);
    let client = BridgeAdapterContractClient::new(env, &id);
    (id, client)
}

fn mint_token_to(env: &Env, holder: &Address, amount: i128) -> Address {
    let id = env
        .register_stellar_asset_contract_v2(holder.clone())
        .address();
    token::StellarAssetClient::new(env, &id).mint(holder, &amount);
    id
}

fn addr_bytes(env: &Env, addr: &Address) -> Bytes {
    let s = addr.to_string();
    Bytes::from_slice(env, s.as_bytes())
}

#[test]
fn initialize_sets_admin_and_threshold() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &2u32).unwrap();
    assert_eq!(client.get_admin().unwrap(), admin);
    assert_eq!(client.get_relayer_threshold().unwrap(), 2);
}

#[test]
fn initialize_rejects_zero_threshold() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy(&env);
    let e = client
        .try_initialize(&admin, &0u32)
        .unwrap_err()
        .unwrap();
    assert_eq!(e, ContractError::InvalidThreshold);
}

#[test]
fn initialize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &2u32).unwrap();
    let e = client
        .try_initialize(&admin, &1u32)
        .unwrap_err()
        .unwrap();
    assert_eq!(e, ContractError::AlreadyInitialized);
}

#[test]
fn lock_and_bridge_holds_tokens_and_records_deposit() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let (bridge_id, client) = deploy(&env);
    client.initialize(&admin, &2u32).unwrap();
    let tok = mint_token_to(&env, &depositor, 1_000_000i128);
    let bal_before = token::Client::new(&env, &tok).balance(&depositor);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &100i128,
            &137u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    let dep = client.get_deposit(&dep_id).unwrap();
    assert_eq!(dep.depositor, depositor);
    assert_eq!(dep.token, tok);
    assert_eq!(dep.amount, 100);
    assert_eq!(dep.target_chain, 137);
    assert_eq!(dep.status, DepositStatus::Pending);
    assert_eq!(dep.nonce, 1);
    let tc = token::Client::new(&env, &tok);
    assert_eq!(tc.balance(&depositor), bal_before - 100);
    assert_eq!(tc.balance(&bridge_id), 100);
}

#[test]
fn lock_empty_target_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    let tok = mint_token_to(&env, &depositor, 100i128);
    let e = client
        .try_lock_and_bridge(&depositor, &tok, &10i128, &1u32, &Bytes::new(&env))
        .unwrap_err()
        .unwrap();
    assert_eq!(e, ContractError::InvalidTargetAddress);
}

#[test]
fn confirm_non_relayer_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let r1 = Address::generate(&env);
    let stranger = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    client.add_relayer(&admin, &r1).unwrap();
    let tok = mint_token_to(&env, &depositor, 1_000i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &50i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    let th = Bytes::from_slice(&env, &[0xabu8; 32]);
    let e = client
        .try_confirm_relay(&stranger, &dep_id, &th)
        .unwrap_err()
        .unwrap();
    assert_eq!(e, ContractError::RelayerNotFound);
}

#[test]
fn confirm_inactive_relayer_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let r1 = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    client.add_relayer(&admin, &r1).unwrap();
    client.remove_relayer(&admin, &r1).unwrap();
    let tok = mint_token_to(&env, &depositor, 500i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &50i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    let th = Bytes::from_slice(&env, &[1u8; 32]);
    let e = client
        .try_confirm_relay(&r1, &dep_id, &th)
        .unwrap_err()
        .unwrap();
    assert_eq!(e, ContractError::NotActiveRelayer);
}

#[test]
fn m_of_n_relay_marks_completed() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &2u32).unwrap();
    client.add_relayer(&admin, &r1).unwrap();
    client.add_relayer(&admin, &r2).unwrap();
    let tok = mint_token_to(&env, &depositor, 1_000i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &80i128,
            &8453u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();

    let th = Bytes::from_slice(&env, &[2u8; 32]);
    client.confirm_relay(&r1, &dep_id, &th).unwrap();
    let d1 = client.get_deposit(&dep_id).unwrap();
    assert_eq!(d1.status, DepositStatus::Relayed);
    assert_eq!(d1.relay_confirmations, 1);

    client.confirm_relay(&r2, &dep_id, &th).unwrap();
    let d2 = client.get_deposit(&dep_id).unwrap();
    assert_eq!(d2.status, DepositStatus::Completed);
    assert_eq!(d2.relay_confirmations, 2);
    assert_eq!(d2.dest_tx_hash, th);
}

#[test]
fn same_relayer_cannot_confirm_twice() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let r1 = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &2u32).unwrap();
    client.add_relayer(&admin, &r1).unwrap();
    let tok = mint_token_to(&env, &depositor, 500i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &50i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    let th = Bytes::from_slice(&env, &[3u8; 32]);
    client.confirm_relay(&r1, &dep_id, &th).unwrap();
    let e = client
        .try_confirm_relay(&r1, &dep_id, &th)
        .unwrap_err()
        .unwrap();
    assert_eq!(e, ContractError::AlreadyConfirmed);
}

#[test]
fn second_relayer_must_match_tx_hash() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &2u32).unwrap();
    client.add_relayer(&admin, &r1).unwrap();
    client.add_relayer(&admin, &r2).unwrap();
    let tok = mint_token_to(&env, &depositor, 500i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &50i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    let th1 = Bytes::from_slice(&env, &[4u8; 32]);
    let th2 = Bytes::from_slice(&env, &[5u8; 32]);
    client.confirm_relay(&r1, &dep_id, &th1).unwrap();
    let e = client
        .try_confirm_relay(&r2, &dep_id, &th2)
        .unwrap_err()
        .unwrap();
    assert_eq!(e, ContractError::DestTxHashMismatch);
}

#[test]
fn refund_after_timeout_returns_tokens() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.timestamp = 10_000);
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &2u32).unwrap();
    let tok = mint_token_to(&env, &depositor, 1_000i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &200i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    let bal_locked = token::Client::new(&env, &tok).balance(&depositor);
    let future = 10_000 + REFUND_TIMEOUT_SECS + 1;
    env.ledger().with_mut(|li| li.timestamp = future);
    client.refund(&depositor, &dep_id).unwrap();
    let tc = token::Client::new(&env, &tok);
    assert_eq!(tc.balance(&depositor), bal_locked + 200);
    assert_eq!(
        client.get_deposit(&dep_id).unwrap().status,
        DepositStatus::Refunded
    );
}

#[test]
fn refund_before_timeout_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.timestamp = 5_000);
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    let tok = mint_token_to(&env, &depositor, 500i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &50i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    let e = client
        .try_refund(&depositor, &dep_id)
        .unwrap_err()
        .unwrap();
    assert_eq!(e, ContractError::RefundTooEarly);
}

#[test]
fn only_depositor_can_refund() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.timestamp = 0);
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let other = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    let tok = mint_token_to(&env, &depositor, 500i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &50i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    env.ledger().with_mut(|li| li.timestamp = REFUND_TIMEOUT_SECS + 1);
    let e = client.try_refund(&other, &dep_id).unwrap_err().unwrap();
    assert_eq!(e, ContractError::NotDepositor);
}

#[test]
fn cannot_refund_completed() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let r1 = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    client.add_relayer(&admin, &r1).unwrap();
    let tok = mint_token_to(&env, &depositor, 500i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &50i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    client
        .confirm_relay(
            &r1,
            &dep_id,
            &Bytes::from_slice(&env, &[9u8; 32]),
        )
        .unwrap();
    env.ledger().with_mut(|li| li.timestamp = REFUND_TIMEOUT_SECS + 10_000);
    let e = client.try_refund(&depositor, &dep_id).unwrap_err().unwrap();
    assert_eq!(e, ContractError::InvalidDepositStatus);
}

#[test]
fn relayer_totals_increment() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let r1 = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    client.add_relayer(&admin, &r1).unwrap();
    let tok = mint_token_to(&env, &depositor, 500i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &50i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    client
        .confirm_relay(
            &r1,
            &dep_id,
            &Bytes::from_slice(&env, &[7u8; 32]),
        )
        .unwrap();
    let rec = client.get_relayer(&r1).unwrap();
    assert_eq!(rec.total_relayed, 1);
}

#[test]
fn duplicate_active_relayer_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let r1 = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    client.add_relayer(&admin, &r1).unwrap();
    let e = client.try_add_relayer(&admin, &r1).unwrap_err().unwrap();
    assert_eq!(e, ContractError::RelayerAlreadyActive);
}

#[test]
fn confirm_empty_tx_hash_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let r1 = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    client.add_relayer(&admin, &r1).unwrap();
    let tok = mint_token_to(&env, &depositor, 500i128);
    let dep_id = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &10i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    let e = client
        .try_confirm_relay(&r1, &dep_id, &Bytes::new(&env))
        .unwrap_err()
        .unwrap();
    assert_eq!(e, ContractError::InvalidTxHash);
}

#[test]
fn non_admin_cannot_add_relayer() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let bad = Address::generate(&env);
    let r1 = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    let e = client.try_add_relayer(&bad, &r1).unwrap_err().unwrap();
    assert_eq!(e, ContractError::Unauthorized);
}

#[test]
fn get_deposit_unknown_none() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    let fake = soroban_sdk::BytesN::from_array(&env, &[0xffu8; 32]);
    assert!(client.get_deposit(&fake).is_none());
}

#[test]
fn nonce_increments_per_lock() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let (_, client) = deploy(&env);
    client.initialize(&admin, &1u32).unwrap();
    let tok = mint_token_to(&env, &depositor, 1_000i128);
    let d0 = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &1i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    let d1 = client
        .lock_and_bridge(
            &depositor,
            &tok,
            &1i128,
            &1u32,
            &addr_bytes(&env, &Address::generate(&env)),
        )
        .unwrap();
    assert_eq!(client.get_deposit(&d0).unwrap().nonce, 1);
    assert_eq!(client.get_deposit(&d1).unwrap().nonce, 2);
}
