use soroban_sdk::{contracttype, BytesN, Symbol};

/// How long a key record lives in persistent storage (~180 days at 5s/ledger).
pub const KEY_TTL_LEDGERS: u32 = 3_110_400;

/// Maximum number of historical key records retained per address.
pub const MAX_KEY_HISTORY: u32 = 50;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KeyRecord {
    /// The raw 32-byte public key (e.g. X25519 or Ed25519).
    pub public_key: BytesN<32>,
    /// Application-defined label: e.g. `Symbol::new(env, "x25519")`.
    pub key_type: Symbol,
    /// Monotonically increasing version, starting at 1.
    pub version: u32,
    /// Ledger timestamp at registration time.
    pub registered_at: u64,
    /// Ledger timestamp at revocation time; 0 means still active.
    pub revoked_at: u64,
    /// Whether this record is the current active key.
    pub is_active: bool,
}
