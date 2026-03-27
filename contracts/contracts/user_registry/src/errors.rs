use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum UserRegistryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    UserNotFound = 4,
    UsernameTaken = 5,
    InvalidUsername = 6,
    UserAlreadyRegistered = 7,
    AccountDeactivated = 8,
    InvalidPublicKey = 9,
    InvalidDisplayName = 10,
    InvalidAvatarHash = 11,
}
