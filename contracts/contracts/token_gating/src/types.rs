use soroban_sdk::{contracttype, Address, BytesN};
use gasless_common::types::TokenAmount;

/// Unique identifier for a group (matches group_management contract)
pub type GroupId = BytesN<32>;

/// Configuration for a token gate on a group
#[contracttype]
#[derive(Clone, Debug)]
pub struct GateConfig {
    /// The token contract address (SEP-41 / SAC token or NFT)
    pub token: Address,
    /// Minimum token balance required (enforced > 0 at construction via TokenAmount).
    /// For NFT ownership: set to TokenAmount(1).
    pub min_balance: TokenAmount,
    /// The admin address that set the gate (only admin can update/remove)
    pub admin: Address,
    /// Timestamp when the gate was last updated
    pub set_at: u64,
}
