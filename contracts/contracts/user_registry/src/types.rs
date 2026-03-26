use soroban_sdk::{contracttype, Address, BytesN, Symbol};

/// How long a user record lives in persistent storage (~180 days at 5s/ledger).
pub const USER_TTL_LEDGERS: u32 = 3_110_400;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserRecord {
    /// The user's wallet address.
    pub address: Address,
    /// Unique username (Symbol).
    pub username: Symbol,
    /// Public key for identity verification.
    pub public_key: BytesN<32>,
    /// Optional display name.
    pub display_name: Option<Symbol>,
    /// Optional avatar hash (IPFS or content hash).
    pub avatar_hash: Option<BytesN<32>>,
    /// Timestamp when the user registered.
    pub registered_at: u64,
    /// Timestamp when the profile was last updated.
    pub updated_at: u64,
    /// Whether the account is active.
    pub is_active: bool,
}
