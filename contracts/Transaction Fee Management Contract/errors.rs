use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FeeError {
    /// Caller is not the admin
    Unauthorized = 1,
    /// Contract has not been initialised yet
    NotInitialized = 2,
    /// Fee config contains an invalid bps value (> 10 000)
    InvalidFeeBps = 3,
    /// Amount must be positive
    InvalidAmount = 4,
    /// Requested withdrawal exceeds collected balance
    InsufficientBalance = 5,
    /// Fee config has already been set (use update instead)
    AlreadyInitialized = 6,
    /// Arithmetic overflow while calculating fee
    Overflow = 7,
}
