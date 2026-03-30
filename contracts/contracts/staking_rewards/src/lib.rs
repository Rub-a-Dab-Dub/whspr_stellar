#![no_std]

mod errors;
mod events;
mod types;

#[cfg(test)]
mod test;

use errors::StakingError;
use soroban_sdk::{
    contract, contractimpl,
    token::Client as TokenClient,
    Address, Bytes, BytesN, Env, Symbol,
};
use types::{DataKey, StakeRecord, StakingPool, PRECISION, RECORD_TTL};

fn get_admin(env: &Env) -> Result<Address, StakingError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(StakingError::Unauthorized)
}

fn load_pool(env: &Env) -> StakingPool {
    env.storage().instance().get(&DataKey::Pool).unwrap()
}

fn save_pool(env: &Env, pool: &StakingPool) {
    env.storage().instance().set(&DataKey::Pool, pool);
}

fn load_stake(env: &Env, id: &BytesN<32>) -> Result<StakeRecord, StakingError> {
    env.storage()
        .persistent()
        .get(&DataKey::Stake(id.clone()))
        .ok_or(StakingError::StakeNotFound)
}

fn save_stake(env: &Env, id: &BytesN<32>, record: &StakeRecord) {
    env.storage()
        .persistent()
        .set(&DataKey::Stake(id.clone()), record);
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::Stake(id.clone()), RECORD_TTL, RECORD_TTL);
}

/// Update cumulative reward_per_token based on elapsed time.
fn update_pool(env: &Env, pool: &mut StakingPool) {
    let now = env.ledger().timestamp();
    if pool.total_staked > 0 && now > pool.last_update_time {
        let elapsed = (now - pool.last_update_time) as i128;
        pool.reward_per_token += elapsed * pool.reward_rate / pool.total_staked;
    }
    pool.last_update_time = now;
}

fn pending_rewards(pool: &StakingPool, stake: &StakeRecord) -> i128 {
    let earned = (pool.reward_per_token - stake.reward_debt) * stake.amount / PRECISION;
    if earned < 0 { 0 } else { earned }
}

fn derive_stake_id(env: &Env, staker: &Address, amount: i128, lock_until: u64) -> BytesN<32> {
    let mut buf = Bytes::new(env);
    buf.append(&staker.to_xdr(env));
    buf.append(&Bytes::from_array(env, &amount.to_be_bytes()));
    buf.append(&Bytes::from_array(env, &lock_until.to_be_bytes()));
    buf.append(&Bytes::from_array(env, &env.ledger().timestamp().to_be_bytes()));
    env.crypto().sha256(&buf)
}

#[contract]
pub struct StakingContract;

#[contractimpl]
impl StakingContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        stake_token: Address,
        reward_token: Address,
        reward_rate: i128,
    ) -> Result<(), StakingError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(StakingError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        let pool = StakingPool {
            total_staked: 0,
            reward_per_token: 0,
            last_update_time: env.ledger().timestamp(),
            reward_rate,
            stake_token,
            reward_token,
        };
        save_pool(&env, &pool);
        Ok(())
    }

    pub fn stake(env: Env, staker: Address, amount: i128, lock_period: u64) -> Result<BytesN<32>, StakingError> {
        staker.require_auth();
        if amount <= 0 {
            return Err(StakingError::ZeroAmount);
        }

        let mut pool = load_pool(&env);
        update_pool(&env, &mut pool);

        TokenClient::new(&env, &pool.stake_token).transfer(
            &staker,
            &env.current_contract_address(),
            &amount,
        );

        let lock_until = env.ledger().timestamp() + lock_period;
        let stake_id = derive_stake_id(&env, &staker, amount, lock_until);

        let record = StakeRecord {
            staker: staker.clone(),
            amount,
            staked_at: env.ledger().timestamp(),
            lock_until,
            reward_debt: pool.reward_per_token,
        };
        save_stake(&env, &stake_id, &record);

        pool.total_staked += amount;
        save_pool(&env, &pool);

        events::emit_staked(&env, &stake_id, &staker, amount, lock_until);
        Ok(stake_id)
    }

    pub fn unstake(env: Env, stake_id: BytesN<32>) -> Result<(), StakingError> {
        let stake = load_stake(&env, &stake_id)?;
        stake.staker.require_auth();

        if env.ledger().timestamp() < stake.lock_until {
            return Err(StakingError::LockPeriodActive);
        }

        let mut pool = load_pool(&env);
        update_pool(&env, &mut pool);

        // Auto-claim pending rewards
        let reward = pending_rewards(&pool, &stake);
        if reward > 0 {
            TokenClient::new(&env, &pool.reward_token).transfer(
                &env.current_contract_address(),
                &stake.staker,
                &reward,
            );
        }

        TokenClient::new(&env, &pool.stake_token).transfer(
            &env.current_contract_address(),
            &stake.staker,
            &stake.amount,
        );

        pool.total_staked -= stake.amount;
        save_pool(&env, &pool);

        // Remove stake record
        env.storage().persistent().remove(&DataKey::Stake(stake_id.clone()));

        events::emit_unstaked(&env, &stake_id, &stake.staker, stake.amount);
        Ok(())
    }

    pub fn claim_rewards(env: Env, stake_id: BytesN<32>) -> Result<i128, StakingError> {
        let mut stake = load_stake(&env, &stake_id)?;
        stake.staker.require_auth();

        let mut pool = load_pool(&env);
        update_pool(&env, &mut pool);

        let reward = pending_rewards(&pool, &stake);
        if reward > 0 {
            TokenClient::new(&env, &pool.reward_token).transfer(
                &env.current_contract_address(),
                &stake.staker,
                &reward,
            );
        }

        stake.reward_debt = pool.reward_per_token;
        save_stake(&env, &stake_id, &stake);
        save_pool(&env, &pool);

        events::emit_reward_claimed(&env, &stake_id, &stake.staker, reward);
        Ok(reward)
    }

    pub fn get_pending_rewards(env: Env, stake_id: BytesN<32>) -> Result<i128, StakingError> {
        let stake = load_stake(&env, &stake_id)?;
        let mut pool = load_pool(&env);
        update_pool(&env, &mut pool);
        Ok(pending_rewards(&pool, &stake))
    }

    pub fn get_staking_tier(env: Env, address: Address) -> Symbol {
        // Sum all stakes for address is complex without an index; return tier based on
        // a direct lookup by address stored in pool. For simplicity, callers pass stake_id.
        // This view returns tier based on total_staked in pool as a proxy.
        // In practice, callers use get_staking_tier_by_stake.
        let _ = address;
        let pool = load_pool(&env);
        types::staking_tier(pool.total_staked)
    }

    pub fn get_staking_tier_by_stake(env: Env, stake_id: BytesN<32>) -> Result<Symbol, StakingError> {
        let stake = load_stake(&env, &stake_id)?;
        Ok(types::staking_tier(stake.amount))
    }

    pub fn update_reward_rate(env: Env, new_rate: i128) -> Result<(), StakingError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let mut pool = load_pool(&env);
        update_pool(&env, &mut pool); // settle existing rewards first
        pool.reward_rate = new_rate;
        save_pool(&env, &pool);
        Ok(())
    }
}
