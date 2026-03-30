use soroban_sdk::{contracttype, Address, BytesN};

pub const RECORD_TTL: u32 = 3_110_400; // ~180 days

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignRecord {
    pub token: Address,
    pub total_amount: i128,
    pub claimed_amount: i128,
    pub merkle_root: BytesN<32>,
    pub start: u64,
    pub end: u64,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Campaign(BytesN<32>),
    Claimed(BytesN<32>, Address), // (campaign_id, claimer)
}
