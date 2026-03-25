use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Map, Symbol};

use crate::{
    errors::FeeError,
    events,
    storage::{
        self, add_to_fee_balance, get_admin, get_fee_balance, get_fee_config, get_user_tier,
        is_operation_waived, op_transfer, set_admin, set_fee_config, set_operation_waiver,
        set_user_tier, subtract_from_fee_balance, BPS_DENOMINATOR,
    },
    types::{FeeConfig, UserTier},
};

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct FeeContract;

#[contractimpl]
impl FeeContract {
    // ── Initialisation ────────────────────────────────────────────────────────

    /// One-time setup: records the admin and writes the initial fee config.
    pub fn initialize(
        env: Env,
        admin: Address,
        base_fee_bps: u32,
        tier_discounts: Map<Symbol, u32>,
    ) -> Result<(), FeeError> {
        if get_admin(&env).is_some() {
            return Err(FeeError::AlreadyInitialized);
        }

        Self::validate_bps(base_fee_bps)?;
        for (_, discount) in tier_discounts.iter() {
            Self::validate_bps(discount)?;
        }

        set_admin(&env, &admin);

        let config = FeeConfig {
            base_fee_bps,
            tier_discounts,
        };
        set_fee_config(&env, &config);
        events::emit_config_set(&env, &admin, &config);
        Ok(())
    }

    // ── Admin: fee configuration ──────────────────────────────────────────────

    /// Update the fee config (admin-only).
    ///
    /// `tier_discounts` is a `Map<Symbol, u32>` where each value is the
    /// discount in basis points subtracted from `base_fee_bps`.
    pub fn set_fee_config(
        env: Env,
        caller: Address,
        base_fee_bps: u32,
        tier_discounts: Map<Symbol, u32>,
    ) -> Result<(), FeeError> {
        caller.require_auth();
        Self::require_admin(&env, &caller)?;

        Self::validate_bps(base_fee_bps)?;
        for (_, discount) in tier_discounts.iter() {
            Self::validate_bps(discount)?;
        }

        let config = FeeConfig {
            base_fee_bps,
            tier_discounts,
        };
        set_fee_config(&env, &config);
        events::emit_config_set(&env, &caller, &config);
        Ok(())
    }

    // ── Admin: user tier management ───────────────────────────────────────────

    /// Assign a fee tier to a user (admin-only).
    pub fn set_user_tier(
        env: Env,
        caller: Address,
        user: Address,
        tier: UserTier,
    ) -> Result<(), FeeError> {
        caller.require_auth();
        Self::require_admin(&env, &caller)?;

        let tier_sym = tier.as_symbol();
        set_user_tier(&env, &user, &tier);
        events::emit_tier_set(&env, &user, &tier_sym);
        Ok(())
    }

    // ── Admin: operation waivers ──────────────────────────────────────────────

    /// Enable or disable a fee waiver for a specific operation type (admin-only).
    pub fn set_fee_waiver(
        env: Env,
        caller: Address,
        operation: Symbol,
        waived: bool,
    ) -> Result<(), FeeError> {
        caller.require_auth();
        Self::require_admin(&env, &caller)?;

        set_operation_waiver(&env, &operation, waived);
        events::emit_waiver_set(&env, &operation, waived);
        Ok(())
    }

    // ── Admin: withdraw collected fees ────────────────────────────────────────

    /// Withdraw `amount` from the accumulated fee balance to `recipient`.
    /// In a real deployment this would also call a token transfer; here we
    /// track the balance and emit an event so that an outer orchestrator can
    /// execute the actual token movement atomically.
    pub fn withdraw_fees(
        env: Env,
        caller: Address,
        recipient: Address,
        amount: i128,
    ) -> Result<(), FeeError> {
        caller.require_auth();
        Self::require_admin(&env, &caller)?;

        if amount <= 0 {
            return Err(FeeError::InvalidAmount);
        }

        let balance = get_fee_balance(&env);
        if amount > balance {
            return Err(FeeError::InsufficientBalance);
        }

        subtract_from_fee_balance(&env, amount);
        events::emit_fee_withdrawn(&env, &recipient, amount);
        Ok(())
    }

    // ── View: fee calculation ─────────────────────────────────────────────────

    /// Calculate the fee for `amount` for a given `user`, respecting tier
    /// discounts and operation waivers.  Returns 0 if the operation is waived.
    ///
    /// Formula:
    ///   effective_bps = base_fee_bps - tier_discount_bps   (floor 0)
    ///   fee           = amount * effective_bps / 10_000
    pub fn calculate_fee(
        env: Env,
        amount: i128,
        user: Address,
        operation: Symbol,
    ) -> Result<i128, FeeError> {
        if amount <= 0 {
            return Err(FeeError::InvalidAmount);
        }

        // Waived operation → zero fee
        if is_operation_waived(&env, &operation) {
            return Ok(0);
        }

        let config = get_fee_config(&env).ok_or(FeeError::NotInitialized)?;

        let effective_bps = Self::effective_bps_for_user(&env, &user, &config);
        let fee = Self::compute_fee(amount, effective_bps)?;
        Ok(fee)
    }

    /// Convenience variant that uses the default "transfer" operation type.
    pub fn calculate_transfer_fee(
        env: Env,
        amount: i128,
        user: Address,
    ) -> Result<i128, FeeError> {
        Self::calculate_fee(env, amount, user, op_transfer())
    }

    // ── View: balance query ───────────────────────────────────────────────────

    /// Returns the total fees collected and not yet withdrawn.
    pub fn get_fee_balance(env: Env) -> i128 {
        get_fee_balance(&env)
    }

    /// Returns the current fee configuration.
    pub fn get_fee_config(env: Env) -> Result<FeeConfig, FeeError> {
        get_fee_config(&env).ok_or(FeeError::NotInitialized)
    }

    /// Returns the tier symbol for a user.
    pub fn get_user_tier(env: Env, user: Address) -> Symbol {
        get_user_tier(&env, &user).as_symbol()
    }

    /// Returns whether a given operation is fee-waived.
    pub fn is_operation_waived(env: Env, operation: Symbol) -> bool {
        is_operation_waived(&env, &operation)
    }

    // ── Internal: fee collection (called by sibling contracts or internally) ──

    /// Record a fee collection atomically.  The `payer` must have already
    /// authorised the outer transfer; this function only updates internal
    /// bookkeeping and emits the event.
    ///
    /// Returns the fee amount that was collected.
    pub fn collect_fee(
        env: Env,
        amount: i128,
        payer: Address,
        operation: Symbol,
    ) -> Result<i128, FeeError> {
        if amount <= 0 {
            return Err(FeeError::InvalidAmount);
        }

        // Waived operation → no fee recorded
        if is_operation_waived(&env, &operation) {
            return Ok(0);
        }

        let config = get_fee_config(&env).ok_or(FeeError::NotInitialized)?;
        let effective_bps = Self::effective_bps_for_user(&env, &payer, &config);
        let fee = Self::compute_fee(amount, effective_bps)?;

        if fee > 0 {
            add_to_fee_balance(&env, fee);
            events::emit_fee_collected(&env, &payer, amount, fee, &operation);
        }

        Ok(fee)
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn require_admin(env: &Env, caller: &Address) -> Result<(), FeeError> {
        let admin = get_admin(env).ok_or(FeeError::NotInitialized)?;
        if admin != *caller {
            return Err(FeeError::Unauthorized);
        }
        Ok(())
    }

    fn validate_bps(bps: u32) -> Result<(), FeeError> {
        if bps > BPS_DENOMINATOR {
            Err(FeeError::InvalidFeeBps)
        } else {
            Ok(())
        }
    }

    /// Resolve the effective basis points for a user after applying their tier
    /// discount (saturating at 0 so fees never go negative).
    fn effective_bps_for_user(env: &Env, user: &Address, config: &FeeConfig) -> u32 {
        let tier = get_user_tier(env, user);
        let tier_sym = tier.as_symbol();
        let discount = config
            .tier_discounts
            .get(tier_sym)
            .unwrap_or(0);

        config.base_fee_bps.saturating_sub(discount)
    }

    /// `fee = amount * bps / 10_000`  with overflow guard.
    fn compute_fee(amount: i128, bps: u32) -> Result<i128, FeeError> {
        let fee = amount
            .checked_mul(bps as i128)
            .ok_or(FeeError::Overflow)?
            .checked_div(BPS_DENOMINATOR as i128)
            .ok_or(FeeError::Overflow)?;
        Ok(fee)
    }
}
