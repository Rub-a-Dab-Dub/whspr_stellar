use soroban_sdk::{contracttype, Address, BytesN, String};

pub const RECORD_TTL: u32 = 3_110_400;
pub const SECS_PER_YEAR: u64 = 365 * 24 * 3600;
pub const GRACE_PERIOD: u64 = 30 * 24 * 3600; // 30 days

/// Base fee per year in stroops
pub const BASE_FEE_PER_YEAR: i128 = 1_000_000;
/// Premium fee for short names (3-5 chars)
pub const PREMIUM_FEE_PER_YEAR: i128 = 5_000_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UsernameRecord {
    pub owner: Address,
    pub username: String,
    pub registered_at: u64,
    pub expires_at: u64,
    pub metadata_hash: Option<BytesN<32>>,
    pub is_locked: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    FeeToken,
    Username(String),           // username → UsernameRecord
    AddressToPrimary(Address),  // address → primary username
}

pub fn registration_fee(username_len: u32, duration_years: u32) -> i128 {
    let per_year = if username_len <= 5 {
        PREMIUM_FEE_PER_YEAR
    } else {
        BASE_FEE_PER_YEAR
    };
    per_year * duration_years as i128
}
