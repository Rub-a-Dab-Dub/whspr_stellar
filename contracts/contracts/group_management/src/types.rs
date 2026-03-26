use soroban_sdk::{contracttype, Address, BytesN, Env, Symbol};

/// Unique identifier for a group
pub type GroupId = BytesN<32>;

/// Role types for group members
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Role {
    Admin,      // Full control over group
    Moderator,  // Can add/remove members
    Member,     // Regular member
}

/// Group record stored on-chain
#[contracttype]
#[derive(Clone, Debug)]
pub struct GroupRecord {
    pub id: GroupId,
    pub name: Symbol,
    pub creator: Address,
    pub admin: Address,
    pub max_members: u32,
    pub member_count: u32,
    pub created_at: u64,
    pub is_active: bool,
}

/// Member record for a specific group
#[contracttype]
#[derive(Clone, Debug)]
pub struct MemberRecord {
    pub address: Address,
    pub role: Role,
    pub joined_at: u64,
}

/// Generate a new GroupId from a counter
pub fn generate_group_id(env: &Env, counter: u64) -> GroupId {
    let mut bytes = [0u8; 32];
    let counter_bytes = counter.to_be_bytes();
    bytes[24..32].copy_from_slice(&counter_bytes);
    BytesN::from_array(env, &bytes)
}
