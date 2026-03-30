use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    EscrowNotFound = 3,
    EscrowNotActive = 4,
    TimeoutNotReached = 5,
    InvalidCondition = 6,
    NotDisputed = 7,
    InvalidSplit = 8,
}
