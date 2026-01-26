use soroban_sdk::{contracttype, Address};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ActionType {
    Message = 0,
    Tip = 1,
    Transfer = 2,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct RateLimitConfig {
    pub message_cooldown: u64, // seconds
    pub tip_cooldown: u64,     // seconds
    pub transfer_cooldown: u64, // seconds
    pub daily_message_limit: u32,
    pub daily_tip_limit: u32,
    pub daily_transfer_limit: u32,
}



#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ContractMetadata {
    pub name: soroban_sdk::Symbol,
    pub version: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformSettings {
    pub fee_percentage: u32,
    pub admin_address: Address,
    pub fee_token: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TreasuryAnalytics {
    pub current_balance: i128,
    pub total_collected: i128,
    pub total_withdrawn: i128,
    pub fee_percentage: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserProfile {
    pub address: Address,
    pub username: soroban_sdk::Symbol,
    pub xp: u64,
    pub level: u32,
    pub badges: soroban_sdk::Vec<soroban_sdk::Symbol>,
    pub join_date: u64,
}



#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct DailyStats {
    pub message_count: u32,
    pub tip_count: u32,
    pub transfer_count: u32,
    pub last_day: u64, // epoch day
}

impl Default for DailyStats {
    fn default() -> Self {
        Self {
            message_count: 0,
            tip_count: 0,
            transfer_count: 0,
            last_day: 0,
        }
    }
}
