#![cfg(test)]

//! Integration tests: FeeContract interacting with a mock TransferContract.
//!
//! The TransferContract calls `FeeContract::collect_fee` atomically inside
//! its own `transfer` function, mirroring real production usage.

use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::Address as _,
    Address, Env, Map, Symbol,
};

use fee_contract::{FeeContract, FeeContractClient, UserTier};

// ── Mock Transfer Contract ────────────────────────────────────────────────────

#[contract]
pub struct TransferContract;

#[contractimpl]
impl TransferContract {
    /// Simulates a transfer that atomically collects a fee via the fee contract.
    /// Returns `(net_amount, fee_amount)`.
    pub fn transfer(
        env: Env,
        fee_contract_id: Address,
        from: Address,
        _to: Address,
        amount: i128,
    ) -> (i128, i128) {
        from.require_auth();

        let fee_client = FeeContractClient::new(&env, &fee_contract_id);
        let fee = fee_client.collect_fee(&amount, &from, &symbol_short!("transfer"));

        let net = amount - fee;
        (net, fee)
    }

    /// Transfer with an operation type that may be waived.
    pub fn transfer_with_op(
        env: Env,
        fee_contract_id: Address,
        from: Address,
        _to: Address,
        amount: i128,
        operation: Symbol,
    ) -> (i128, i128) {
        from.require_auth();

        let fee_client = FeeContractClient::new(&env, &fee_contract_id);
        let fee = fee_client.collect_fee(&amount, &from, &operation);

        (amount - fee, fee)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

struct TestEnv {
    env: Env,
    fee_client: FeeContractClient<'static>,
    transfer_client: TransferContractClient<'static>,
    fee_id: Address,
    admin: Address,
}

impl TestEnv {
    fn new(base_fee_bps: u32) -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let fee_id = env.register_contract(None, FeeContract);
        let transfer_id = env.register_contract(None, TransferContract);

        let fee_client = FeeContractClient::new(&env, &fee_id);
        let transfer_client = TransferContractClient::new(&env, &transfer_id);

        let admin = Address::generate(&env);
        fee_client.initialize(&admin, &base_fee_bps, &Map::new(&env));

        TestEnv {
            env,
            fee_client,
            transfer_client,
            fee_id,
            admin,
        }
    }

    fn new_with_tiers(base_fee_bps: u32) -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let fee_id = env.register_contract(None, FeeContract);
        let transfer_id = env.register_contract(None, TransferContract);

        let fee_client = FeeContractClient::new(&env, &fee_id);
        let transfer_client = TransferContractClient::new(&env, &transfer_id);

        let admin = Address::generate(&env);

        let mut discounts: Map<Symbol, u32> = Map::new(&env);
        discounts.set(symbol_short!("silver"), 10);
        discounts.set(symbol_short!("gold"), 25);
        discounts.set(symbol_short!("platinum"), 50);
        fee_client.initialize(&admin, &base_fee_bps, &discounts);

        TestEnv {
            env,
            fee_client,
            transfer_client,
            fee_id,
            admin,
        }
    }
}

// ── Integration tests ─────────────────────────────────────────────────────────

#[test]
fn test_transfer_collects_fee_atomically() {
    let t = TestEnv::new(100); // 1 %
    let from = Address::generate(&t.env);
    let to = Address::generate(&t.env);

    let (net, fee) = t
        .transfer_client
        .transfer(&t.fee_id, &from, &to, &10_000);

    assert_eq!(fee, 100);
    assert_eq!(net, 9_900);
    assert_eq!(t.fee_client.get_fee_balance(), 100);
}

#[test]
fn test_transfer_accumulates_across_multiple_txns() {
    let t = TestEnv::new(50); // 0.50 %
    let from = Address::generate(&t.env);
    let to = Address::generate(&t.env);

    for _ in 0..5 {
        t.transfer_client
            .transfer(&t.fee_id, &from, &to, &10_000);
    }

    // 0.50 % of 10_000 = 50; × 5 = 250
    assert_eq!(t.fee_client.get_fee_balance(), 250);
}

#[test]
fn test_gold_tier_user_pays_discounted_fee() {
    let t = TestEnv::new_with_tiers(100); // base = 1 %
    let from = Address::generate(&t.env);
    let to = Address::generate(&t.env);

    t.fee_client
        .set_user_tier(&t.admin, &from, &UserTier::Gold);

    let (net, fee) = t
        .transfer_client
        .transfer(&t.fee_id, &from, &to, &10_000);

    // 100 - 25 = 75 bps → 0.75 % of 10_000 = 75
    assert_eq!(fee, 75);
    assert_eq!(net, 9_925);
}

#[test]
fn test_platinum_tier_pays_minimal_fee() {
    let t = TestEnv::new_with_tiers(100);
    let from = Address::generate(&t.env);
    let to = Address::generate(&t.env);

    t.fee_client
        .set_user_tier(&t.admin, &from, &UserTier::Platinum);

    let (_net, fee) = t
        .transfer_client
        .transfer(&t.fee_id, &from, &to, &10_000);

    // 100 - 50 = 50 bps → 50
    assert_eq!(fee, 50);
}

#[test]
fn test_waived_operation_no_fee_collected() {
    let t = TestEnv::new(100);
    let from = Address::generate(&t.env);
    let to = Address::generate(&t.env);

    t.fee_client
        .set_fee_waiver(&t.admin, &symbol_short!("stake"), &true);

    let (net, fee) = t.transfer_client.transfer_with_op(
        &t.fee_id,
        &from,
        &to,
        &10_000,
        symbol_short!("stake"),
    );

    assert_eq!(fee, 0);
    assert_eq!(net, 10_000);
    assert_eq!(t.fee_client.get_fee_balance(), 0);
}

#[test]
fn test_mixed_operations_some_waived() {
    let t = TestEnv::new(100); // 1 %
    let from = Address::generate(&t.env);
    let to = Address::generate(&t.env);

    // Waive stake only
    t.fee_client
        .set_fee_waiver(&t.admin, &symbol_short!("stake"), &true);

    // Taxed transfer
    t.transfer_client.transfer_with_op(
        &t.fee_id,
        &from,
        &to,
        &10_000,
        symbol_short!("transfer"),
    );
    // Waived stake
    t.transfer_client.transfer_with_op(
        &t.fee_id,
        &from,
        &to,
        &10_000,
        symbol_short!("stake"),
    );
    // Taxed swap
    t.transfer_client.transfer_with_op(
        &t.fee_id,
        &from,
        &to,
        &10_000,
        symbol_short!("swap"),
    );

    // Only 2 × 100 = 200 collected (stake waived)
    assert_eq!(t.fee_client.get_fee_balance(), 200);
}

#[test]
fn test_admin_withdraw_after_collections() {
    let t = TestEnv::new(100);
    let from = Address::generate(&t.env);
    let to = Address::generate(&t.env);
    let treasury = Address::generate(&t.env);

    t.transfer_client
        .transfer(&t.fee_id, &from, &to, &10_000); // +100
    t.transfer_client
        .transfer(&t.fee_id, &from, &to, &10_000); // +100

    assert_eq!(t.fee_client.get_fee_balance(), 200);

    t.fee_client.withdraw_fees(&t.admin, &treasury, &150);
    assert_eq!(t.fee_client.get_fee_balance(), 50);

    t.fee_client.withdraw_fees(&t.admin, &treasury, &50);
    assert_eq!(t.fee_client.get_fee_balance(), 0);
}

#[test]
fn test_tier_upgrade_mid_session_applies_immediately() {
    let t = TestEnv::new_with_tiers(100);
    let from = Address::generate(&t.env);
    let to = Address::generate(&t.env);

    // Before upgrade: standard tier → 100 bps
    let (_net, fee1) = t
        .transfer_client
        .transfer(&t.fee_id, &from, &to, &10_000);
    assert_eq!(fee1, 100);

    // Upgrade to gold
    t.fee_client
        .set_user_tier(&t.admin, &from, &UserTier::Gold);

    // After upgrade: 75 bps
    let (_net, fee2) = t
        .transfer_client
        .transfer(&t.fee_id, &from, &to, &10_000);
    assert_eq!(fee2, 75);

    assert_eq!(t.fee_client.get_fee_balance(), 175);
}

#[test]
fn test_different_users_different_tiers() {
    let t = TestEnv::new_with_tiers(100);
    let to = Address::generate(&t.env);

    let standard_user = Address::generate(&t.env);
    let gold_user = Address::generate(&t.env);
    let platinum_user = Address::generate(&t.env);

    t.fee_client
        .set_user_tier(&t.admin, &gold_user, &UserTier::Gold);
    t.fee_client
        .set_user_tier(&t.admin, &platinum_user, &UserTier::Platinum);

    let (_n, f_std) = t
        .transfer_client
        .transfer(&t.fee_id, &standard_user, &to, &10_000);
    let (_n, f_gold) = t
        .transfer_client
        .transfer(&t.fee_id, &gold_user, &to, &10_000);
    let (_n, f_plat) = t
        .transfer_client
        .transfer(&t.fee_id, &platinum_user, &to, &10_000);

    assert_eq!(f_std, 100);
    assert_eq!(f_gold, 75);
    assert_eq!(f_plat, 50);

    // Total = 225
    assert_eq!(t.fee_client.get_fee_balance(), 225);
}

#[test]
fn test_fee_config_change_affects_future_transfers() {
    let t = TestEnv::new(200); // 2 %
    let from = Address::generate(&t.env);
    let to = Address::generate(&t.env);

    let (_n, fee_before) = t
        .transfer_client
        .transfer(&t.fee_id, &from, &to, &10_000);
    assert_eq!(fee_before, 200); // 2 %

    // Halve the fee
    t.fee_client
        .set_fee_config(&t.admin, &100, &Map::new(&t.env));

    let (_n, fee_after) = t
        .transfer_client
        .transfer(&t.fee_id, &from, &to, &10_000);
    assert_eq!(fee_after, 100); // 1 %
}
