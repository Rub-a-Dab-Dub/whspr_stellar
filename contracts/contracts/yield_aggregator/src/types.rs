use soroban_sdk::{contracttype, Address, BytesN};

pub const STRATEGY_TTL: u32 = 3_110_400; // ~1 year in ledgers

pub type StrategyId = BytesN<32>;

/// On-chain record for a DeFi yield strategy.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct YieldStrategy {
    pub strategy_id: StrategyId,
    /// Address of the external DeFi protocol contract.
    pub protocol_address: Address,
    /// Token accepted/returned by this strategy.
    pub token: Address,
    /// Latest APY in basis points (500 = 5.00%).
    pub apy_bps: u32,
    /// Total underlying token value locked (in token's smallest unit).
    pub tvl: i128,
    /// Total shares outstanding for this strategy.
    pub total_shares: i128,
    pub is_active: bool,
    pub last_updated: u64,
}

/// Per-user position inside a single strategy.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserYieldPosition {
    pub user: Address,
    pub strategy_id: StrategyId,
    /// Cumulative raw token amount deposited by this user.
    pub deposited: i128,
    /// Shares held by this user in the strategy pool.
    pub shares: i128,
    pub last_harvested: u64,
}

/// Storage keys.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    StrategyCount,
    Strategy(StrategyId),
    Position(Address, StrategyId),
}
