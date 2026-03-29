use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum StakingError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    StakeNotFound = 3,
    LockPeriodActive = 4,
    ZeroAmount = 5,
}
