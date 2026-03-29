#![allow(deprecated)]

use bridge_adapter::{BridgeAdapterContract, BridgeAdapterContractClient, DepositStatus};
use soroban_sdk::{
    testutils::Address as _,
    token, Address, Bytes, Env,
};

fn env_setup() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn mint(env: &Env, holder: &Address) -> Address {
    let id = env
        .register_stellar_asset_contract_v2(holder.clone())
        .address();
    token::StellarAssetClient::new(env, &id).mint(holder, &500_000_000i128);
    id
}

fn as_target(env: &Env, addr: &Address) -> Bytes {
    Bytes::from_slice(env, addr.to_string().as_bytes())
}

#[test]
fn integration_full_bridge_polygon_to_evm_style_flow() {
    let env = env_setup();
    let bridge_id = env.register_contract(None, BridgeAdapterContract);
    let bridge = BridgeAdapterContractClient::new(&env, &bridge_id);

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let rel_a = Address::generate(&env);
    let rel_b = Address::generate(&env);

    bridge.initialize(&admin, &2u32).unwrap();
    bridge.add_relayer(&admin, &rel_a).unwrap();
    bridge.add_relayer(&admin, &rel_b).unwrap();

    let tok = mint(&env, &depositor);
    let amount = 1_250_000i128;
    let dest = Address::generate(&env);

    let dep_id = bridge
        .lock_and_bridge(
            &depositor,
            &tok,
            &amount,
            &137u32,
            &as_target(&env, &dest),
        )
        .unwrap();

    assert_eq!(
        token::Client::new(&env, &tok).balance(&bridge_id),
        amount
    );

    let evm_tx = Bytes::from_slice(&env, &[0x81u8; 32]);
    bridge.confirm_relay(&rel_a, &dep_id, &evm_tx).unwrap();
    let d_mid = bridge.get_deposit(&dep_id).unwrap();
    assert_eq!(d_mid.status, DepositStatus::Relayed);

    bridge.confirm_relay(&rel_b, &dep_id, &evm_tx).unwrap();
    let d_done = bridge.get_deposit(&dep_id).unwrap();
    assert_eq!(d_done.status, DepositStatus::Completed);
    assert_eq!(d_done.relay_confirmations, 2);

    assert_eq!(
        bridge.get_relayer(&rel_a).unwrap().total_relayed,
        1u64
    );
    assert_eq!(
        bridge.get_relayer(&rel_b).unwrap().total_relayed,
        1u64
    );
}

#[test]
fn integration_refund_after_deadline_when_under_threshold() {
    let env = env_setup();
    env.ledger().with_mut(|li| li.timestamp = 100);
    let bridge_id = env.register_contract(None, BridgeAdapterContract);
    let bridge = BridgeAdapterContractClient::new(&env, &bridge_id);

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    bridge.initialize(&admin, &3u32).unwrap();

    let tok = mint(&env, &depositor);
    let dep_id = bridge
        .lock_and_bridge(
            &depositor,
            &tok,
            &50_000i128,
            &8453u32,
            &as_target(&env, &Address::generate(&env)),
        )
        .unwrap();

    let bal = token::Client::new(&env, &tok).balance(&depositor);
    env.ledger().with_mut(|li| {
        li.timestamp = 100 + bridge_adapter::REFUND_TIMEOUT_SECS + 1
    });
    bridge.refund(&depositor, &dep_id).unwrap();
    assert_eq!(
        token::Client::new(&env, &tok).balance(&depositor),
        bal + 50_000i128
    );
}
