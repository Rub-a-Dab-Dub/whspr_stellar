use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Contract admin.
    Admin,
    /// Active KeyRecord for an address.
    ActiveKey(Address),
    /// Current version counter for an address.
    KeyVersion(Address),
    /// Historical KeyRecord list (Vec<KeyRecord>) for an address.
    KeyHistory(Address),
}
