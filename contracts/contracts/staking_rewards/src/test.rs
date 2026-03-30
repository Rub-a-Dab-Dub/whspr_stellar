#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, StakingContract);

    let token_admin = Address::generate(&env);
    let stake_token = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let reward_token = env.register_stellar_asset_contract_v2(token_admin.clone()).address();

    // reward_rate = 1 token/sec scaled by PRECISION
    let reward_rate = types::PRECISION;
    StakingContractClient::new(&env, &contract_id)
        .initialize(&admin, &stake_token, &reward_token, &reward_rate);

    // Fund reward pool
    StellarAssetClient::new(&env, &reward_token).mint(&contract_id, &1_000_000);

    (env, contract_id, admin, stake_token, reward_token)
}

#[test]
fn test_stake_and_unstake() {
    let (env, contract_id, _admin, stake_token, _reward_token) = setup();
    let client = StakingContractClient::new(&env, &contract_id);
    let staker = Address::generate(&env);
    StellarAssetClient::new(&env, &stake_token).mint(&staker, &1000);

    env.ledger().set_timestamp(1000);
    let sid = client.stake(&staker, &1000, &3600u64);

    env.ledger().set_timestamp(5000); // past lock
    client.unstake(&sid);

    assert_eq!(TokenClient::new(&env, &stake_token).balance(&staker), 1000);
}

#[test]
#[should_panic(expected = "LockPeriodActive")]
fn test_early_unstake_fails() {
    let (env, contract_id, _admin, stake_token, _reward_token) = setup();
    let client = StakingContractClient::new(&env, &contract_id);
    let staker = Address::generate(&env);
    StellarAssetClient::new(&env, &stake_token).mint(&staker, &1000);

    env.ledger().set_timestamp(1000);
    let sid = client.stake(&staker, &1000, &3600u64);
    client.unstake(&sid); // still locked
}

#[test]
fn test_rewards_accumulate() {
    let (env, contract_id, _admin, stake_token, reward_token) = setup();
    let client = StakingContractClient::new(&env, &contract_id);
    let staker = Address::generate(&env);
    StellarAssetClient::new(&env, &stake_token).mint(&staker, &1000);

    env.ledger().set_timestamp(1000);
    let sid = client.stake(&staker, &1000, &0u64);

    env.ledger().set_timestamp(1100); // 100 seconds elapsed
    let reward = client.claim_rewards(&sid);
    // reward_rate = PRECISION per sec, 100 sec, 1000 staked → 100 * PRECISION / 1000 * 1000 / PRECISION = 100
    assert_eq!(reward, 100);
    assert_eq!(TokenClient::new(&env, &reward_token).balance(&staker), 100);
}

#[test]
fn test_staking_tier() {
    let (env, contract_id, _admin, stake_token, _reward_token) = setup();
    let client = StakingContractClient::new(&env, &contract_id);
    let staker = Address::generate(&env);
    StellarAssetClient::new(&env, &stake_token).mint(&staker, &10_000);

    env.ledger().set_timestamp(1000);
    let sid = client.stake(&staker, &10_000, &0u64);
    let tier = client.get_staking_tier_by_stake(&sid);
    assert_eq!(tier, soroban_sdk::symbol_short!("gold"));
}

#[test]
fn test_update_reward_rate() {
    let (env, contract_id, admin, _stake_token, _reward_token) = setup();
    let client = StakingContractClient::new(&env, &contract_id);
    client.update_reward_rate(&(types::PRECISION * 2));
    // Just verify it doesn't panic and pool is updated
}
