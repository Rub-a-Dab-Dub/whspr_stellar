use soroban_sdk::{contracttype, symbol_short, Address, BytesN, Symbol};

pub const RECORD_TTL: u32 = 3_110_400;

/// Tier thresholds (in token units)
pub const TIER_GOLD: i128 = 10_000;
pub const TIER_SILVER: i128 = 1_000;
pub const TIER_BRONZE: i128 = 100;

/// Precision multiplier for reward-per-token accumulator
pub const PRECISION: i128 = 1_000_000_000_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakeRecord {
    pub staker: Address,
    pub amount: i128,
    pub staked_at: u64,
    pub lock_until: u64,
    pub reward_debt: i128, // reward_per_token snapshot at stake time * amount
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakingPool {
    pub total_staked: i128,
    pub reward_per_token: i128, // cumulative, scaled by PRECISION
    pub last_update_time: u64,
    pub reward_rate: i128, // tokens per second, scaled by PRECISION
    pub stake_token: Address,
    pub reward_token: Address,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Pool,
    Stake(BytesN<32>),
}

pub fn staking_tier(amount: i128) -> Symbol {
    if amount >= TIER_GOLD {
        symbol_short!("gold")
    } else if amount >= TIER_SILVER {
        symbol_short!("silver")
    } else if amount >= TIER_BRONZE {
        symbol_short!("bronze")
    } else {
        symbol_short!("none")
    }
}
