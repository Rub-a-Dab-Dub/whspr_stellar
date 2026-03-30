use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum YieldError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    StrategyNotFound = 4,
    StrategyAlreadyExists = 5,
    StrategyInactive = 6,
    PositionNotFound = 7,
    InsufficientShares = 8,
    InsufficientTvl = 9,
    InvalidAmount = 10,
    ZeroShares = 11,
}
