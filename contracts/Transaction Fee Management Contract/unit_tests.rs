#![cfg(test)]

use soroban_sdk::{
    symbol_short, testutils::Address as _, Address, Env, Map, Symbol,
};

use fee_contract::{FeeContract, FeeContractClient, FeeError, UserTier};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup_env() -> (Env, FeeContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FeeContract);
    let client = FeeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    (env, client, admin)
}

/// Initialise with a given base bps and no tier discounts.
fn init_simple(client: &FeeContractClient, admin: &Address, base_bps: u32) {
    let env = client.env.clone();
    let discounts: Map<Symbol, u32> = Map::new(&env);
    client.initialize(admin, &base_bps, &discounts);
}

/// Initialise with standard tier discounts applied.
fn init_with_tiers(client: &FeeContractClient, admin: &Address) {
    let env = client.env.clone();
    let mut discounts: Map<Symbol, u32> = Map::new(&env);
    discounts.set(symbol_short!("silver"), 10);   // 10 bps off
    discounts.set(symbol_short!("gold"), 25);     // 25 bps off
    discounts.set(symbol_short!("platinum"), 50); // 50 bps off
    client.initialize(admin, &100, &discounts);    // base = 100 bps (1 %)
}

// ── Initialisation tests ──────────────────────────────────────────────────────

#[test]
fn test_initialize_success() {
    let (_env, client, admin) = setup_env();
    init_simple(&client, &admin, 50);
    // Fee balance starts at zero
    assert_eq!(client.get_fee_balance(), 0);
}

#[test]
fn test_double_initialize_fails() {
    let (_env, client, admin) = setup_env();
    init_simple(&client, &admin, 50);
    let result = client.try_initialize(&admin, &50, &Map::new(&client.env));
    assert_eq!(result, Err(Ok(FeeError::AlreadyInitialized)));
}

#[test]
fn test_initialize_invalid_bps_fails() {
    let (_env, client, admin) = setup_env();
    let result = client.try_initialize(&admin, &10_001, &Map::new(&client.env));
    assert_eq!(result, Err(Ok(FeeError::InvalidFeeBps)));
}

// ── Fee calculation ───────────────────────────────────────────────────────────

#[test]
fn test_calculate_fee_basic() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100); // 1 %
    let user = Address::generate(&env);

    // 1 % of 1_000 = 10
    let fee = client.calculate_fee(&1_000, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 10);
}

#[test]
fn test_calculate_fee_zero_bps() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 0);
    let user = Address::generate(&env);

    let fee = client.calculate_fee(&1_000_000, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 0);
}

#[test]
fn test_calculate_fee_large_amount() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 30); // 0.30 %
    let user = Address::generate(&env);

    // 0.30 % of 1_000_000 = 3_000
    let fee = client.calculate_fee(&1_000_000, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 3_000);
}

#[test]
fn test_calculate_fee_rounding_truncates() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 1); // 0.01 %
    let user = Address::generate(&env);

    // 0.01 % of 1 = 0.0001 → truncates to 0
    let fee = client.calculate_fee(&1, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 0);

    // 0.01 % of 100 = 0.01 → truncates to 0
    let fee = client.calculate_fee(&100, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 0);

    // 0.01 % of 10_000 = 1
    let fee = client.calculate_fee(&10_000, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 1);
}

#[test]
fn test_calculate_fee_invalid_amount() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let user = Address::generate(&env);

    let result = client.try_calculate_fee(&0, &user, &symbol_short!("transfer"));
    assert_eq!(result, Err(Ok(FeeError::InvalidAmount)));

    let result = client.try_calculate_fee(&-1, &user, &symbol_short!("transfer"));
    assert_eq!(result, Err(Ok(FeeError::InvalidAmount)));
}

// ── Tier discount tests ───────────────────────────────────────────────────────

#[test]
fn test_standard_tier_gets_no_discount() {
    let (env, client, admin) = setup_env();
    init_with_tiers(&client, &admin);
    let user = Address::generate(&env);
    // Standard tier → no entry in discounts map → full 100 bps
    // 1 % of 10_000 = 100
    let fee = client.calculate_fee(&10_000, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 100);
}

#[test]
fn test_silver_tier_discount() {
    let (env, client, admin) = setup_env();
    init_with_tiers(&client, &admin);
    let user = Address::generate(&env);
    client.set_user_tier(&admin, &user, &UserTier::Silver);

    // 100 - 10 = 90 bps → 0.90 % of 10_000 = 90
    let fee = client.calculate_fee(&10_000, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 90);
}

#[test]
fn test_gold_tier_discount() {
    let (env, client, admin) = setup_env();
    init_with_tiers(&client, &admin);
    let user = Address::generate(&env);
    client.set_user_tier(&admin, &user, &UserTier::Gold);

    // 100 - 25 = 75 bps → 0.75 % of 10_000 = 75
    let fee = client.calculate_fee(&10_000, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 75);
}

#[test]
fn test_platinum_tier_discount() {
    let (env, client, admin) = setup_env();
    init_with_tiers(&client, &admin);
    let user = Address::generate(&env);
    client.set_user_tier(&admin, &user, &UserTier::Platinum);

    // 100 - 50 = 50 bps → 0.50 % of 10_000 = 50
    let fee = client.calculate_fee(&10_000, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 50);
}

#[test]
fn test_discount_cannot_exceed_base_fee() {
    let (env, client, admin) = setup_env();
    // base = 30 bps, platinum discount = 50 bps  →  saturates to 0
    let mut discounts: Map<Symbol, u32> = Map::new(&env);
    discounts.set(symbol_short!("platinum"), 50);
    client.initialize(&admin, &30, &discounts);

    let user = Address::generate(&env);
    client.set_user_tier(&admin, &user, &UserTier::Platinum);

    let fee = client.calculate_fee(&10_000, &user, &symbol_short!("transfer"));
    assert_eq!(fee, 0); // saturated subtraction → 0 bps
}

// ── Fee collection tests ──────────────────────────────────────────────────────

#[test]
fn test_collect_fee_updates_balance() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100); // 1 %
    let payer = Address::generate(&env);

    let fee = client.collect_fee(&10_000, &payer, &symbol_short!("transfer"));
    assert_eq!(fee, 100);
    assert_eq!(client.get_fee_balance(), 100);
}

#[test]
fn test_collect_fee_accumulates() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let payer = Address::generate(&env);

    client.collect_fee(&10_000, &payer, &symbol_short!("transfer"));
    client.collect_fee(&10_000, &payer, &symbol_short!("transfer"));
    client.collect_fee(&10_000, &payer, &symbol_short!("transfer"));

    assert_eq!(client.get_fee_balance(), 300);
}

#[test]
fn test_collect_fee_waived_operation() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    client.set_fee_waiver(&admin, &symbol_short!("stake"), &true);
    let payer = Address::generate(&env);

    let fee = client.collect_fee(&10_000, &payer, &symbol_short!("stake"));
    assert_eq!(fee, 0);
    assert_eq!(client.get_fee_balance(), 0);
}

#[test]
fn test_collect_fee_invalid_amount() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let payer = Address::generate(&env);

    let result = client.try_collect_fee(&0, &payer, &symbol_short!("transfer"));
    assert_eq!(result, Err(Ok(FeeError::InvalidAmount)));
}

// ── Operation waiver tests ────────────────────────────────────────────────────

#[test]
fn test_operation_waiver_toggle() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let op = symbol_short!("swap");

    assert!(!client.is_operation_waived(&op));

    client.set_fee_waiver(&admin, &op, &true);
    assert!(client.is_operation_waived(&op));

    client.set_fee_waiver(&admin, &op, &false);
    assert!(!client.is_operation_waived(&op));
}

#[test]
fn test_calculate_fee_waived_returns_zero() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let user = Address::generate(&env);
    client.set_fee_waiver(&admin, &symbol_short!("swap"), &true);

    let fee = client.calculate_fee(&1_000_000, &user, &symbol_short!("swap"));
    assert_eq!(fee, 0);
}

// ── Withdrawal tests ──────────────────────────────────────────────────────────

#[test]
fn test_withdraw_fees_success() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let payer = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.collect_fee(&10_000, &payer, &symbol_short!("transfer")); // fee = 100
    client.withdraw_fees(&admin, &recipient, &50);

    assert_eq!(client.get_fee_balance(), 50);
}

#[test]
fn test_withdraw_entire_balance() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let payer = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.collect_fee(&10_000, &payer, &symbol_short!("transfer")); // 100
    client.withdraw_fees(&admin, &recipient, &100);

    assert_eq!(client.get_fee_balance(), 0);
}

#[test]
fn test_withdraw_more_than_balance_fails() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let payer = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.collect_fee(&10_000, &payer, &symbol_short!("transfer")); // 100
    let result = client.try_withdraw_fees(&admin, &recipient, &101);
    assert_eq!(result, Err(Ok(FeeError::InsufficientBalance)));
}

#[test]
fn test_withdraw_zero_fails() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let recipient = Address::generate(&env);

    let result = client.try_withdraw_fees(&admin, &recipient, &0);
    assert_eq!(result, Err(Ok(FeeError::InvalidAmount)));
}

// ── Authorisation tests ───────────────────────────────────────────────────────

#[test]
fn test_non_admin_cannot_set_fee_config() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let attacker = Address::generate(&env);

    let result = client.try_set_fee_config(&attacker, &50, &Map::new(&env));
    assert_eq!(result, Err(Ok(FeeError::Unauthorized)));
}

#[test]
fn test_non_admin_cannot_withdraw() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let attacker = Address::generate(&env);
    let recipient = Address::generate(&env);

    let result = client.try_withdraw_fees(&attacker, &recipient, &1);
    assert_eq!(result, Err(Ok(FeeError::Unauthorized)));
}

#[test]
fn test_non_admin_cannot_set_tier() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let attacker = Address::generate(&env);
    let user = Address::generate(&env);

    let result = client.try_set_user_tier(&attacker, &user, &UserTier::Gold);
    assert_eq!(result, Err(Ok(FeeError::Unauthorized)));
}

#[test]
fn test_non_admin_cannot_set_waiver() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let attacker = Address::generate(&env);

    let result = client.try_set_fee_waiver(&attacker, &symbol_short!("stake"), &true);
    assert_eq!(result, Err(Ok(FeeError::Unauthorized)));
}

// ── Config update tests ───────────────────────────────────────────────────────

#[test]
fn test_admin_can_update_fee_config() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let user = Address::generate(&env);

    // Before: 1 % of 10_000 = 100
    assert_eq!(client.calculate_fee(&10_000, &user, &symbol_short!("transfer")), 100);

    // Update to 50 bps
    client.set_fee_config(&admin, &50, &Map::new(&env));

    // After: 0.5 % of 10_000 = 50
    assert_eq!(client.calculate_fee(&10_000, &user, &symbol_short!("transfer")), 50);
}

#[test]
fn test_update_config_invalid_bps_fails() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);

    let result = client.try_set_fee_config(&admin, &10_001, &Map::new(&env));
    assert_eq!(result, Err(Ok(FeeError::InvalidFeeBps)));
}

// ── View helpers ──────────────────────────────────────────────────────────────

#[test]
fn test_get_user_tier_default() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let user = Address::generate(&env);

    assert_eq!(client.get_user_tier(&user), symbol_short!("standard"));
}

#[test]
fn test_get_user_tier_after_set() {
    let (env, client, admin) = setup_env();
    init_simple(&client, &admin, 100);
    let user = Address::generate(&env);
    client.set_user_tier(&admin, &user, &UserTier::Platinum);

    assert_eq!(client.get_user_tier(&user), symbol_short!("platinum"));
}

#[test]
fn test_get_fee_config() {
    let (env, client, admin) = setup_env();
    let mut discounts: Map<Symbol, u32> = Map::new(&env);
    discounts.set(symbol_short!("gold"), 20);
    client.initialize(&admin, &150, &discounts);

    let cfg = client.get_fee_config();
    assert_eq!(cfg.base_fee_bps, 150);
    assert_eq!(cfg.tier_discounts.get(symbol_short!("gold")), Some(20));
}
