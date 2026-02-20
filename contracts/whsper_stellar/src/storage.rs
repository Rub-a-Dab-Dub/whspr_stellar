use crate::types::{ActionType, Badge};
use soroban_sdk::{contracttype, Address, String, Symbol, Vec};

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
    NextClaimId,
    ClaimConfig,
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

