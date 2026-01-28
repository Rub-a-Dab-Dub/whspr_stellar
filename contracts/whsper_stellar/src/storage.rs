use crate::types::ActionType;
use soroban_sdk::{contracttype, Address};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Metadata,
    RateLimitConfig,
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
    Room(soroban_sdk::Symbol),
    RoomMember(soroban_sdk::Symbol, Address),
    CreatorBalance(Address),
    HourlyXp(Address, u64),
    Room(u64),
    RoomList,
    NextRoomId,
    Message(u64, u64),
    NextMessageId(u64),
    MessageCount(u64),
}
