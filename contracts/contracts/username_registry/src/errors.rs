use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    UsernameTaken = 3,
    UsernameNotFound = 4,
    UsernameExpired = 5,
    InGracePeriod = 6,
    InvalidUsername = 7,
    NotOwner = 8,
    NoPrimaryUsername = 9,
}
