use crate::types::{ActionType, Badge};
use soroban_sdk::{contracttype, Address, BytesN, String, Symbol, Vec};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Metadata,
    RateLimitConfig,
    ClaimWindowConfig,
    UserLastAction(Address, ActionType),
    UserDailyStats(Address),
    UserReputation(Address),
    AdminOverride(Address),
    Treasury,
    PlatformSettings,
    TotalFeesCollected,
    TotalFeesWithdrawn,
    User(Address),
    Username(soroban_sdk::Symbol),
    PaidRoom(soroban_sdk::Symbol),
    PaidRoomMember(soroban_sdk::Symbol, Address),
    CreatorBalance(Address),
    HourlyXp(Address, u64),
    BadgeMetadata(Badge),
    UserMessageCount(Address),
    UserTipReceivedCount(Address),
    UserRoomsCreated(Address),
    RoomById(u64),
    RoomList,
    NextRoomId,
    Message(u64, u64),
    NextMessageId(u64),
    MessageCount(u64),
    NextInvitationId,
    Invitation(u64),
    UserInvitations(Address),
    RoomInvitations(u64),
    Claim(u64),
    ClaimsByCreator(Address),
    ClaimsByRecipient(Address),
    NextClaimId,
    ClaimConfig,
    UserRatingContext(Address, Address, Symbol),
    ReputationHistory(Address),
    ChatTransfer(BytesN<32>),
    MessageTip(BytesN<32>),
    SplitBill(BytesN<32>),
    // Multi-token support
    RegisteredToken(Address),
    TokenList,
    TokenMetadata(Address),
    TokenWhitelist(Address),
    TokenBlacklist(Address),
    // Tip tracking
    TipCount,
    TipById(u64),
    TipsSentByUser(Address),
    TipsReceivedByUser(Address),
    TotalTippedByUser(Address),
    // Transaction tracking
    TransactionCount,
    TransactionById(u64),
    TransactionsByUser(Address),
    // Analytics
    AnalyticsDashboard,
}

#[derive(Clone)]
#[contracttype]
pub struct ChatTransfer {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub conversation_id: BytesN<32>,
    pub timestamp: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct TipRecord {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub message_id: BytesN<32>,
    pub timestamp: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct BillSplit {
    pub from: Address,
    pub recipients: Vec<Address>,
    pub amounts: Vec<i128>,
    pub conversation_id: BytesN<32>,
    pub timestamp: u64,
}

#[contracttype]
pub struct Tip {
    pub id: u64,
    pub sender: Address,
    pub receiver: Address,
    pub amount: i128,
    pub fee: i128,
    pub message_id: u64,
    pub timestamp: u64,
}

