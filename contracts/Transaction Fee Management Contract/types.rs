use soroban_sdk::{contracttype, symbol_short, Address, Map, Symbol};

/// Fee configuration stored on-chain
#[contracttype]
#[derive(Clone, Debug)]
pub struct FeeConfig {
    /// Base fee in basis points (1 bps = 0.01%)
    pub base_fee_bps: u32,
    /// Map of tier symbol -> discount in basis points
    pub tier_discounts: Map<Symbol, u32>,
}

/// User fee tier
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum UserTier {
    Standard,
    Silver,
    Gold,
    Platinum,
}

impl UserTier {
    pub fn as_symbol(&self) -> Symbol {
        match self {
            UserTier::Standard => symbol_short!("standard"),
            UserTier::Silver => symbol_short!("silver"),
            UserTier::Gold => symbol_short!("gold"),
            UserTier::Platinum => symbol_short!("platinum"),
        }
    }
}

/// Operation types that can be waived
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum OperationType {
    Transfer,
    Swap,
    Stake,
    Unstake,
    Custom(Symbol),
}

/// Fee collection record for events
#[contracttype]
#[derive(Clone, Debug)]
pub struct FeeRecord {
    pub payer: Address,
    pub amount: i128,
    pub fee_charged: i128,
    pub tier_applied: Symbol,
    pub operation: Symbol,
}
