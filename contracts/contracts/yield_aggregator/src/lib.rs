#![no_std]

mod errors;
mod events;
mod types;

#[cfg(test)]
mod test;

use errors::YieldError;
use soroban_sdk::{
    contract, contractimpl,
    token::Client as TokenClient,
    xdr::ToXdr,
    Address, Bytes, BytesN, Env,
};
use types::{DataKey, StrategyId, UserYieldPosition, YieldStrategy, STRATEGY_TTL};

// ── Storage helpers ──────────────────────────────────────────────────────────

fn get_admin(env: &Env) -> Result<Address, YieldError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(YieldError::NotInitialized)
}

fn save_strategy(env: &Env, strategy: &YieldStrategy) {
    let key = DataKey::Strategy(strategy.strategy_id.clone());
    env.storage().persistent().set(&key, strategy);
    env.storage().persistent().extend_ttl(&key, STRATEGY_TTL, STRATEGY_TTL);
}

fn load_strategy(env: &Env, id: &StrategyId) -> Result<YieldStrategy, YieldError> {
    env.storage()
        .persistent()
        .get(&DataKey::Strategy(id.clone()))
        .ok_or(YieldError::StrategyNotFound)
}

fn save_position(env: &Env, pos: &UserYieldPosition) {
    let key = DataKey::Position(pos.user.clone(), pos.strategy_id.clone());
    env.storage().persistent().set(&key, pos);
    env.storage().persistent().extend_ttl(&key, STRATEGY_TTL, STRATEGY_TTL);
}

fn load_position(env: &Env, user: &Address, id: &StrategyId) -> Result<UserYieldPosition, YieldError> {
    env.storage()
        .persistent()
        .get(&DataKey::Position(user.clone(), id.clone()))
        .ok_or(YieldError::PositionNotFound)
}

// ── Math helpers ─────────────────────────────────────────────────────────────

/// Convert token amount → shares.  On an empty pool 1 share == 1 token.
fn amount_to_shares(amount: i128, tvl: i128, total_shares: i128) -> i128 {
    if total_shares == 0 || tvl == 0 {
        return amount;
    }
    amount
        .checked_mul(total_shares)
        .unwrap()
        .checked_div(tvl)
        .unwrap()
}

/// Convert shares → underlying token amount.  On an empty pool 1 share == 1 token.
fn shares_to_amount(shares: i128, tvl: i128, total_shares: i128) -> i128 {
    if total_shares == 0 || tvl == 0 {
        return shares;
    }
    shares
        .checked_mul(tvl)
        .unwrap()
        .checked_div(total_shares)
        .unwrap()
}

/// Derive a deterministic StrategyId from (protocol, token) using their XDR
/// encoding so we can hash them without a std String.
fn derive_strategy_id(env: &Env, protocol: &Address, token: &Address) -> StrategyId {
    let mut raw = Bytes::new(env);
    raw.append(&protocol.to_xdr(env));
    raw.append(&token.to_xdr(env));
    env.crypto().sha256(&raw).into()
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct YieldAggregator;

#[contractimpl]
impl YieldAggregator {
    // ── Initialisation ───────────────────────────────────────────────────────

    pub fn initialize(env: Env, admin: Address) -> Result<(), YieldError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(YieldError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    // ── Admin: add strategy ──────────────────────────────────────────────────

    /// Register a new yield strategy.  Admin only.
    /// Returns the deterministic StrategyId = sha256(protocol_xdr ++ token_xdr).
    pub fn add_strategy(
        env: Env,
        protocol: Address,
        token: Address,
    ) -> Result<StrategyId, YieldError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let strategy_id = derive_strategy_id(&env, &protocol, &token);

        if env
            .storage()
            .persistent()
            .has(&DataKey::Strategy(strategy_id.clone()))
        {
            return Err(YieldError::StrategyAlreadyExists);
        }

        let now = env.ledger().timestamp();
        let strategy = YieldStrategy {
            strategy_id: strategy_id.clone(),
            protocol_address: protocol,
            token,
            apy_bps: 0,
            tvl: 0,
            total_shares: 0,
            is_active: true,
            last_updated: now,
        };

        save_strategy(&env, &strategy);
        Ok(strategy_id)
    }

    // ── Admin: rebalance ─────────────────────────────────────────────────────

    /// Move underlying value from one strategy's TVL to another.  Admin only.
    pub fn rebalance(
        env: Env,
        from: StrategyId,
        to: StrategyId,
        amount: i128,
    ) -> Result<(), YieldError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        if amount <= 0 {
            return Err(YieldError::InvalidAmount);
        }

        let mut from_s = load_strategy(&env, &from)?;
        let mut to_s = load_strategy(&env, &to)?;

        if !from_s.is_active {
            return Err(YieldError::StrategyInactive);
        }
        if !to_s.is_active {
            return Err(YieldError::StrategyInactive);
        }
        if from_s.tvl < amount {
            return Err(YieldError::InsufficientTvl);
        }

        // Move value between strategies.  In production this would call
        // the underlying protocol's withdraw/deposit endpoints; here we
        // update TVL accounting only (no token transfer between protocols).
        let now = env.ledger().timestamp();
        from_s.tvl -= amount;
        from_s.last_updated = now;
        save_strategy(&env, &from_s);

        to_s.tvl += amount;
        to_s.last_updated = now;
        save_strategy(&env, &to_s);

        events::emit_rebalance(&env, &from, &to, amount);
        Ok(())
    }

    // ── User: deposit ────────────────────────────────────────────────────────

    /// Deposit `amount` tokens into `strategy_id`.
    /// Transfers tokens from `user` to the contract, mints proportional shares.
    /// Returns shares minted.
    pub fn deposit(
        env: Env,
        user: Address,
        strategy_id: StrategyId,
        amount: i128,
    ) -> Result<i128, YieldError> {
        user.require_auth();

        if amount <= 0 {
            return Err(YieldError::InvalidAmount);
        }

        let mut strategy = load_strategy(&env, &strategy_id)?;
        if !strategy.is_active {
            return Err(YieldError::StrategyInactive);
        }

        // Pull tokens from user into this contract.
        TokenClient::new(&env, &strategy.token).transfer(
            &user,
            &env.current_contract_address(),
            &amount,
        );

        let shares = amount_to_shares(amount, strategy.tvl, strategy.total_shares);
        if shares <= 0 {
            return Err(YieldError::ZeroShares);
        }

        strategy.tvl += amount;
        strategy.total_shares += shares;
        strategy.last_updated = env.ledger().timestamp();
        save_strategy(&env, &strategy);

        let now = env.ledger().timestamp();
        let mut position = load_position(&env, &user, &strategy_id).unwrap_or(UserYieldPosition {
            user: user.clone(),
            strategy_id: strategy_id.clone(),
            deposited: 0,
            shares: 0,
            last_harvested: now,
        });

        position.deposited += amount;
        position.shares += shares;
        save_position(&env, &position);

        events::emit_deposit(&env, &user, &strategy_id, amount, shares);
        Ok(shares)
    }

    // ── User: withdraw ───────────────────────────────────────────────────────

    /// Burn `shares` and return the proportional underlying amount (principal + yield).
    /// Transfers tokens from the contract back to `user`.
    pub fn withdraw(
        env: Env,
        user: Address,
        strategy_id: StrategyId,
        shares: i128,
    ) -> Result<i128, YieldError> {
        user.require_auth();

        if shares <= 0 {
            return Err(YieldError::InvalidAmount);
        }

        let mut strategy = load_strategy(&env, &strategy_id)?;
        let mut position = load_position(&env, &user, &strategy_id)?;

        if position.shares < shares {
            return Err(YieldError::InsufficientShares);
        }

        let amount = shares_to_amount(shares, strategy.tvl, strategy.total_shares);
        if amount <= 0 {
            return Err(YieldError::InvalidAmount);
        }

        // Return tokens to user.
        TokenClient::new(&env, &strategy.token).transfer(
            &env.current_contract_address(),
            &user,
            &amount,
        );

        strategy.tvl -= amount;
        strategy.total_shares -= shares;
        strategy.last_updated = env.ledger().timestamp();
        save_strategy(&env, &strategy);

        position.shares -= shares;
        if position.shares == 0 {
            position.deposited = 0;
        } else {
            position.deposited = position.deposited.saturating_sub(amount.min(position.deposited));
        }
        save_position(&env, &position);

        events::emit_withdraw(&env, &user, &strategy_id, shares, amount);
        Ok(amount)
    }

    // ── harvest ──────────────────────────────────────────────────────────────

    /// Claim and compound yield for a strategy.
    ///
    /// Simulates realising 1% of TVL as yield (in production this would call
    /// the external protocol's claim/reward endpoint).
    /// Yield is compounded back into TVL — shares stay the same so each share
    /// appreciates in underlying value.
    /// APY is recalculated from actual yield / elapsed seconds.
    pub fn harvest(env: Env, strategy_id: StrategyId) -> Result<(), YieldError> {
        let mut strategy = load_strategy(&env, &strategy_id)?;
        if !strategy.is_active {
            return Err(YieldError::StrategyInactive);
        }

        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(strategy.last_updated);

        // Simulate 1% yield on current TVL.
        let yield_amount = if strategy.tvl > 0 { strategy.tvl / 100 } else { 0 };
        let tvl_before = strategy.tvl;

        // Compound: grow TVL, shares unchanged → each share is worth more.
        strategy.tvl += yield_amount;

        // Recompute APY in basis points from realised yield over elapsed time.
        if elapsed > 0 && tvl_before > 0 {
            const SECONDS_PER_YEAR: u64 = 31_536_000;
            let annual_yield = (yield_amount as u128)
                .saturating_mul(SECONDS_PER_YEAR as u128)
                / elapsed as u128;
            strategy.apy_bps =
                (annual_yield.saturating_mul(10_000) / tvl_before as u128) as u32;
        }

        strategy.last_updated = now;
        save_strategy(&env, &strategy);

        events::emit_harvest(&env, &strategy_id, yield_amount, strategy.apy_bps);
        Ok(())
    }

    // ── View functions ───────────────────────────────────────────────────────

    pub fn get_apy(env: Env, strategy_id: StrategyId) -> Result<u32, YieldError> {
        Ok(load_strategy(&env, &strategy_id)?.apy_bps)
    }

    pub fn get_position(
        env: Env,
        user: Address,
        strategy_id: StrategyId,
    ) -> Result<UserYieldPosition, YieldError> {
        load_position(&env, &user, &strategy_id)
    }

    pub fn get_strategy(env: Env, strategy_id: StrategyId) -> Result<YieldStrategy, YieldError> {
        load_strategy(&env, &strategy_id)
    }
}
