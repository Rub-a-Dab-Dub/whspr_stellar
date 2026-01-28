use soroban_sdk::{contracttype, Address, Symbol};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ActionType {
    Message = 0,
    Tip = 1,
    Transfer = 2,
    TipReceived = 3,
}

#[derive(Clone)]
#[contracttype]
pub struct Message {
    pub id: u64,
    pub room_id: u64,
    pub sender: Address,
    pub content_hash: BytesN<32>,
    pub timestamp: u64,
    pub tip_amount: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct RateLimitConfig {
    pub message_cooldown: u64,  // seconds
    pub tip_cooldown: u64,      // seconds
    pub transfer_cooldown: u64, // seconds
    pub daily_message_limit: u32,
    pub daily_tip_limit: u32,
    pub daily_transfer_limit: u32,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    UserAlreadyRegistered = 4,
    UserNotFound = 5,
    UsernameTaken = 6,
    InvalidUsername = 7,
    RoomAlreadyExists = 8,
    RoomNotFound = 9,
    RoomCancelled = 10,
    NotRoomCreator = 11,
    AccessAlreadyGranted = 12,
    InsufficientFunds = 13,
    XpCooldownActive = 14,
    XpRateLimited = 15,
    InvalidRoomType = 16,
    UserAlreadyInRoom = 17,
    InvalidContentHash = 18,
    RoomMessageLimitReached = 19,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ActionType {
    Message = 0,
    TipReceived = 1,
    Transfer = 2,
}

#[derive(Clone)]
#[contracttype]
pub enum RoomType {
    Public,
    TokenGated,
    InviteOnly,
}

#[derive(Clone)]
#[contracttype]
pub struct Room {
    pub id: u64,
    pub creator: Address,
    pub room_type: RoomType,
    pub entry_fee: u64, // 0 for non-token-gated
    pub participants: Vec<Address>,
    pub created_at: u64,
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

#[derive(Clone)]
#[contracttype]
pub struct Room {
    pub id: Symbol,
    pub creator: Address,
    pub entry_fee: i128,
    pub is_cancelled: bool,
    pub total_revenue: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct RoomMember {
    pub has_access: bool,
    pub joined_at: u64,
}
