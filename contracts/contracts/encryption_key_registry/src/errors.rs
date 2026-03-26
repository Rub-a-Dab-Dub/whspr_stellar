use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum KeyRegistryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    KeyNotFound = 4,
    KeyAlreadyRevoked = 5,
    InvalidPublicKey = 6,
    NoActiveKey = 7,
}
