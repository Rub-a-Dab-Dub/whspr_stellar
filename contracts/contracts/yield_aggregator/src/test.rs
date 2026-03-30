#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

struct TestSetup {
    env: Env,
    contract_id: Address,
    admin: Address,
    user: Address,
    token_id: Address,
    strategy_id: BytesN<32>,
}

fn setup() -> TestSetup {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, YieldAggregator);
    let client = YieldAggregatorClient::new(&env, &contract_id);
    client.initialize(&admin).unwrap();

    // Deploy a Stellar asset for use as the strategy token.
    let token_admin = Address::generate(&env);
    let token_id = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();

    let user = Address::generate(&env);
    // Mint 100_000 tokens to the user so they can deposit.
    StellarAssetClient::new(&env, &token_id).mint(&user, &100_000);

    // Add a strategy.
    let protocol = Address::generate(&env);
    let strategy_id = client.add_strategy(&protocol, &token_id).unwrap();

    TestSetup { env, contract_id, admin, user, token_id, strategy_id }
}

fn client(s: &TestSetup) -> YieldAggregatorClient<'_> {
    YieldAggregatorClient::new(&s.env, &s.contract_id)
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn test_initialize_ok() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, YieldAggregator);
    let c = YieldAggregatorClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    assert!(c.initialize(&admin).is_ok());
}

#[test]
fn test_double_initialize_fails() {
    let s = setup();
    let result = client(&s).initialize(&s.admin);
    assert_eq!(result, Err(errors::YieldError::AlreadyInitialized));
}

// ── add_strategy ──────────────────────────────────────────────────────────────

#[test]
fn test_add_strategy_returns_active_strategy() {
    let s = setup();
    let strategy = client(&s).get_strategy(&s.strategy_id).unwrap();
    assert_eq!(strategy.token, s.token_id);
    assert!(strategy.is_active);
    assert_eq!(strategy.tvl, 0);
    assert_eq!(strategy.total_shares, 0);
    assert_eq!(strategy.apy_bps, 0);
}

#[test]
fn test_add_strategy_duplicate_fails() {
    let s = setup();
    let protocol = s
        .env
        .storage()
        .persistent()
        .get::<_, YieldStrategy>(&DataKey::Strategy(s.strategy_id.clone()))
        .unwrap()
        .protocol_address;
    // Re-adding same (protocol, token) pair should fail.
    let result = client(&s).add_strategy(&protocol, &s.token_id);
    assert_eq!(result, Err(errors::YieldError::StrategyAlreadyExists));
}

// ── deposit ───────────────────────────────────────────────────────────────────

#[test]
fn test_deposit_mints_one_to_one_on_empty_pool() {
    let s = setup();
    let shares = client(&s).deposit(&s.user, &s.strategy_id, &1_000).unwrap();
    assert_eq!(shares, 1_000);

    let pos = client(&s).get_position(&s.user, &s.strategy_id).unwrap();
    assert_eq!(pos.deposited, 1_000);
    assert_eq!(pos.shares, 1_000);

    let strategy = client(&s).get_strategy(&s.strategy_id).unwrap();
    assert_eq!(strategy.tvl, 1_000);
    assert_eq!(strategy.total_shares, 1_000);
}

#[test]
fn test_deposit_proportional_after_harvest() {
    let s = setup();
    let c = client(&s);

    // User1 deposits 10_000 → 10_000 shares.
    let user1 = Address::generate(&s.env);
    StellarAssetClient::new(&s.env, &s.token_id).mint(&user1, &10_000);
    c.deposit(&user1, &s.strategy_id, &10_000).unwrap();

    // Advance time, harvest → TVL = 10_100, shares = 10_000.
    s.env.ledger().with_mut(|l| l.timestamp = 3_600);
    c.harvest(&s.strategy_id).unwrap();

    let strategy = c.get_strategy(&s.strategy_id).unwrap();
    assert_eq!(strategy.tvl, 10_100);
    assert_eq!(strategy.total_shares, 10_000);

    // User2 deposits 10_100 → shares = 10_100 * 10_000 / 10_100 = 10_000.
    let user2 = Address::generate(&s.env);
    StellarAssetClient::new(&s.env, &s.token_id).mint(&user2, &10_100);
    let shares2 = c.deposit(&user2, &s.strategy_id, &10_100).unwrap();
    assert_eq!(shares2, 10_000);
}

#[test]
fn test_deposit_zero_returns_error() {
    let s = setup();
    let result = client(&s).deposit(&s.user, &s.strategy_id, &0);
    assert_eq!(result, Err(errors::YieldError::InvalidAmount));
}

#[test]
fn test_deposit_unknown_strategy_fails() {
    let s = setup();
    let fake_id = BytesN::from_array(&s.env, &[0u8; 32]);
    let result = client(&s).deposit(&s.user, &fake_id, &100);
    assert_eq!(result, Err(errors::YieldError::StrategyNotFound));
}

#[test]
fn test_deposit_multiple_times_accumulates() {
    let s = setup();
    let c = client(&s);
    c.deposit(&s.user, &s.strategy_id, &500).unwrap();
    c.deposit(&s.user, &s.strategy_id, &500).unwrap();

    let pos = c.get_position(&s.user, &s.strategy_id).unwrap();
    assert_eq!(pos.deposited, 1_000);
    assert_eq!(pos.shares, 1_000);
}

// ── withdraw ──────────────────────────────────────────────────────────────────

#[test]
fn test_withdraw_returns_correct_amount() {
    let s = setup();
    let c = client(&s);

    c.deposit(&s.user, &s.strategy_id, &1_000).unwrap();
    let amount_back = c.withdraw(&s.user, &s.strategy_id, &500).unwrap();

    // 500 shares / 1000 total × 1000 TVL = 500 tokens.
    assert_eq!(amount_back, 500);

    // Verify token was returned to user.
    assert_eq!(
        TokenClient::new(&s.env, &s.token_id).balance(&s.user),
        100_000 - 1_000 + 500
    );

    let strategy = c.get_strategy(&s.strategy_id).unwrap();
    assert_eq!(strategy.tvl, 500);
    assert_eq!(strategy.total_shares, 500);
}

#[test]
fn test_withdraw_includes_accrued_yield() {
    let s = setup();
    let c = client(&s);

    c.deposit(&s.user, &s.strategy_id, &10_000).unwrap();

    // Harvest: TVL = 10_100, shares = 10_000.
    s.env.ledger().with_mut(|l| l.timestamp = 3_600);
    c.harvest(&s.strategy_id).unwrap();

    // Withdraw all 10_000 shares → 10_100 tokens (1 % yield included).
    let amount_back = c.withdraw(&s.user, &s.strategy_id, &10_000).unwrap();
    assert_eq!(amount_back, 10_100);

    let strategy = c.get_strategy(&s.strategy_id).unwrap();
    assert_eq!(strategy.tvl, 0);
    assert_eq!(strategy.total_shares, 0);
}

#[test]
fn test_withdraw_insufficient_shares_fails() {
    let s = setup();
    let c = client(&s);
    c.deposit(&s.user, &s.strategy_id, &1_000).unwrap();
    let result = c.withdraw(&s.user, &s.strategy_id, &1_001);
    assert_eq!(result, Err(errors::YieldError::InsufficientShares));
}

#[test]
fn test_withdraw_no_position_fails() {
    let s = setup();
    let stranger = Address::generate(&s.env);
    let result = client(&s).withdraw(&stranger, &s.strategy_id, &100);
    assert_eq!(result, Err(errors::YieldError::PositionNotFound));
}

#[test]
fn test_withdraw_zero_fails() {
    let s = setup();
    let c = client(&s);
    c.deposit(&s.user, &s.strategy_id, &1_000).unwrap();
    let result = c.withdraw(&s.user, &s.strategy_id, &0);
    assert_eq!(result, Err(errors::YieldError::InvalidAmount));
}

// ── harvest ───────────────────────────────────────────────────────────────────

#[test]
fn test_harvest_compounds_yield_into_tvl() {
    let s = setup();
    let c = client(&s);

    c.deposit(&s.user, &s.strategy_id, &10_000).unwrap();
    s.env.ledger().with_mut(|l| l.timestamp = 3_600);
    c.harvest(&s.strategy_id).unwrap();

    let strategy = c.get_strategy(&s.strategy_id).unwrap();
    // 1% of 10_000 = 100 compounded.
    assert_eq!(strategy.tvl, 10_100);
    // Shares unchanged — existing holders own proportionally more.
    assert_eq!(strategy.total_shares, 10_000);
}

#[test]
fn test_harvest_updates_apy_bps() {
    let s = setup();
    let c = client(&s);

    c.deposit(&s.user, &s.strategy_id, &10_000).unwrap();
    s.env.ledger().with_mut(|l| l.timestamp = 3_600);
    c.harvest(&s.strategy_id).unwrap();

    let strategy = c.get_strategy(&s.strategy_id).unwrap();
    assert!(strategy.apy_bps > 0, "APY should be non-zero after harvest with elapsed > 0");
}

#[test]
fn test_harvest_empty_pool_is_noop() {
    let s = setup();
    // No deposit — harvest should succeed without panic.
    client(&s).harvest(&s.strategy_id).unwrap();
    let strategy = client(&s).get_strategy(&s.strategy_id).unwrap();
    assert_eq!(strategy.tvl, 0);
}

#[test]
fn test_harvest_unknown_strategy_fails() {
    let s = setup();
    let fake_id = BytesN::from_array(&s.env, &[0u8; 32]);
    let result = client(&s).harvest(&fake_id);
    assert_eq!(result, Err(errors::YieldError::StrategyNotFound));
}

// ── rebalance ─────────────────────────────────────────────────────────────────

#[test]
fn test_rebalance_moves_tvl() {
    let s = setup();
    let c = client(&s);

    // Seed strategy1 with 1_000.
    c.deposit(&s.user, &s.strategy_id, &1_000).unwrap();

    // Create a second strategy.
    let protocol2 = Address::generate(&s.env);
    let token2_admin = Address::generate(&s.env);
    let token2_id = s
        .env
        .register_stellar_asset_contract_v2(token2_admin)
        .address();
    let strategy2_id = c.add_strategy(&protocol2, &token2_id).unwrap();

    c.rebalance(&s.strategy_id, &strategy2_id, &400).unwrap();

    let s1 = c.get_strategy(&s.strategy_id).unwrap();
    let s2 = c.get_strategy(&strategy2_id).unwrap();
    assert_eq!(s1.tvl, 600);
    assert_eq!(s2.tvl, 400);
}

#[test]
fn test_rebalance_insufficient_tvl_fails() {
    let s = setup();
    let c = client(&s);

    c.deposit(&s.user, &s.strategy_id, &100).unwrap();

    let protocol2 = Address::generate(&s.env);
    let token2_admin = Address::generate(&s.env);
    let token2_id = s
        .env
        .register_stellar_asset_contract_v2(token2_admin)
        .address();
    let strategy2_id = c.add_strategy(&protocol2, &token2_id).unwrap();

    let result = c.rebalance(&s.strategy_id, &strategy2_id, &101);
    assert_eq!(result, Err(errors::YieldError::InsufficientTvl));
}

#[test]
fn test_rebalance_zero_amount_fails() {
    let s = setup();
    let c = client(&s);
    let protocol2 = Address::generate(&s.env);
    let token2_admin = Address::generate(&s.env);
    let token2_id = s
        .env
        .register_stellar_asset_contract_v2(token2_admin)
        .address();
    let strategy2_id = c.add_strategy(&protocol2, &token2_id).unwrap();
    let result = c.rebalance(&s.strategy_id, &strategy2_id, &0);
    assert_eq!(result, Err(errors::YieldError::InvalidAmount));
}

// ── get_apy ───────────────────────────────────────────────────────────────────

#[test]
fn test_get_apy_zero_before_harvest() {
    let s = setup();
    assert_eq!(client(&s).get_apy(&s.strategy_id).unwrap(), 0);
}

#[test]
fn test_get_apy_nonzero_after_harvest() {
    let s = setup();
    let c = client(&s);
    c.deposit(&s.user, &s.strategy_id, &10_000).unwrap();
    s.env.ledger().with_mut(|l| l.timestamp = 3_600);
    c.harvest(&s.strategy_id).unwrap();
    assert!(c.get_apy(&s.strategy_id).unwrap() > 0);
}

// ── multi-user proportional yield ────────────────────────────────────────────

#[test]
fn test_multi_user_proportional_yield() {
    let s = setup();
    let c = client(&s);

    let user_a = Address::generate(&s.env);
    let user_b = Address::generate(&s.env);
    StellarAssetClient::new(&s.env, &s.token_id).mint(&user_a, &600);
    StellarAssetClient::new(&s.env, &s.token_id).mint(&user_b, &400);

    // A deposits 600, B deposits 400 → 1000 tokens / 1000 shares total.
    c.deposit(&user_a, &s.strategy_id, &600).unwrap();
    c.deposit(&user_b, &s.strategy_id, &400).unwrap();

    // Harvest: TVL = 1010 (1% yield).
    s.env.ledger().with_mut(|l| l.timestamp = 3_600);
    c.harvest(&s.strategy_id).unwrap();

    // A withdraws 600 shares → 600/1000 × 1010 = 606.
    let a_back = c.withdraw(&user_a, &s.strategy_id, &600).unwrap();
    assert_eq!(a_back, 606);

    // B withdraws 400 shares → 400/400 × (1010-606) = 404.
    let b_back = c.withdraw(&user_b, &s.strategy_id, &400).unwrap();
    assert_eq!(b_back, 404);

    let strategy = c.get_strategy(&s.strategy_id).unwrap();
    assert_eq!(strategy.tvl, 0);
    assert_eq!(strategy.total_shares, 0);
}
