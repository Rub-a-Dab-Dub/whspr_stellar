use soroban_sdk::{contracttype, Address};
use crate::types::ActionType;

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
}
