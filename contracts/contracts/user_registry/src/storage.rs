use soroban_sdk::{contracttype, Address, Symbol};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Contract admin.
    Admin,
    /// UserRecord for an address.
    User(Address),
    /// Address lookup by username.
    UsernameToAddress(Symbol),
    /// Registration counter.
    UserCount,
}
