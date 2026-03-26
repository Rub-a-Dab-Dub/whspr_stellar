# Group Management Contract

A comprehensive on-chain group management smart contract for Stellar blockchain that handles group creation, membership management, role-based permissions, and group lifecycle operations.

## Features

### Core Functionality

- **Group Creation**: Create groups with customizable member limits
- **Member Management**: Add and remove members with proper authorization
- **Role-Based Access Control**: Three-tier role system (Admin, Moderator, Member)
- **Admin Transfer**: Transfer admin rights to another member
- **Group Dissolution**: Safely dissolve groups with proper cleanup

### Role Hierarchy

1. **Admin**: Full control over the group
   - Create and dissolve groups
   - Add/remove any member
   - Assign roles to members
   - Transfer admin rights
2. **Moderator**: Limited management capabilities
   - Add new members
   - Remove regular members (not other moderators or admin)
3. **Member**: Regular group participant
   - No management permissions

### Security Features

- Authorization checks on all state-changing operations
- Role-based permission enforcement
- Protection against unauthorized admin removal
- Member capacity limits
- Active/inactive group state management

## Data Structures

### GroupRecord

```rust
pub struct GroupRecord {
    pub id: GroupId,              // Unique group identifier
    pub name: Symbol,             // Group name
    pub creator: Address,         // Original creator
    pub admin: Address,           // Current admin
    pub max_members: u32,         // Maximum member capacity
    pub member_count: u32,        // Current member count
    pub created_at: u64,          // Creation timestamp
    pub is_active: bool,          // Active status
}
```

### MemberRecord

```rust
pub struct MemberRecord {
    pub address: Address,         // Member address
    pub role: Role,               // Member role
    pub joined_at: u64,           // Join timestamp
}
```

### Role

```rust
pub enum Role {
    Admin,      // Full control
    Moderator,  // Can manage members
    Member,     // Regular member
}
```

## Contract Functions

### create_group

```rust
pub fn create_group(
    env: Env,
    creator: Address,
    name: Symbol,
    max_members: u32,
) -> GroupId
```

Creates a new group with the caller as admin.

**Parameters:**

- `creator`: Address of the group creator
- `name`: Group name (Symbol)
- `max_members`: Maximum number of members (1-10000)

**Returns:** Unique `GroupId`

**Events:** `GroupCreated`

### add_member

```rust
pub fn add_member(
    env: Env,
    caller: Address,
    group_id: GroupId,
    member: Address,
)
```

Adds a new member to the group.

**Permissions:** Admin or Moderator

**Events:** `MemberAdded`

### remove_member

```rust
pub fn remove_member(
    env: Env,
    caller: Address,
    group_id: GroupId,
    member: Address,
)
```

Removes a member from the group.

**Permissions:**

- Admin can remove anyone except themselves (unless self-removal)
- Moderator can remove regular members only

**Events:** `MemberRemoved`

### assign_role

```rust
pub fn assign_role(
    env: Env,
    caller: Address,
    group_id: GroupId,
    member: Address,
    role: Role,
)
```

Assigns a role to a group member.

**Permissions:** Admin only

**Events:** `RoleAssigned`

### get_group_members

```rust
pub fn get_group_members(env: Env, group_id: GroupId) -> Vec<Address>
```

Returns list of all member addresses in the group.

**View Function:** No authorization required

### get_member_info

```rust
pub fn get_member_info(
    env: Env,
    group_id: GroupId,
    member: Address,
) -> Option<MemberRecord>
```

Returns detailed information about a specific member.

**View Function:** No authorization required

### get_group_info

```rust
pub fn get_group_info(env: Env, group_id: GroupId) -> Option<GroupRecord>
```

Returns detailed information about a group.

**View Function:** No authorization required

### dissolve_group

```rust
pub fn dissolve_group(
    env: Env,
    caller: Address,
    group_id: GroupId,
)
```

Dissolves a group, marking it as inactive.

**Permissions:** Admin only

**Events:** `GroupDissolved`

### transfer_admin

```rust
pub fn transfer_admin(
    env: Env,
    caller: Address,
    group_id: GroupId,
    new_admin: Address,
)
```

Transfers admin rights to another member.

**Permissions:** Admin only

**Effects:**

- New admin receives Admin role
- Old admin becomes Moderator

**Events:** `AdminTransferred`

## Events

All state-changing operations emit events:

```rust
pub enum GroupEvent {
    GroupCreated {
        group_id: GroupId,
        name: Symbol,
        creator: Address,
        max_members: u32,
    },
    MemberAdded {
        group_id: GroupId,
        member: Address,
        added_by: Address,
    },
    MemberRemoved {
        group_id: GroupId,
        member: Address,
        removed_by: Address,
    },
    RoleAssigned {
        group_id: GroupId,
        member: Address,
        role: Role,
        assigned_by: Address,
    },
    GroupDissolved {
        group_id: GroupId,
        dissolved_by: Address,
        member_count: u32,
    },
    AdminTransferred {
        group_id: GroupId,
        old_admin: Address,
        new_admin: Address,
    },
}
```

## Building

```bash
cd contracts/contracts/group_management
cargo build --target wasm32-unknown-unknown --release
```

## Testing

### Unit Tests

```bash
cargo test
```

### Integration Tests

```bash
# Build the contract first
cargo build --target wasm32-unknown-unknown --release

# Run integration tests
cargo test --test integration_test
```

## Usage Example

```rust
use soroban_sdk::{Env, Address, symbol_short};

// Create a group
let group_id = client.create_group(
    &admin_address,
    &symbol_short!("MyGroup"),
    &100  // max 100 members
);

// Add a member
client.add_member(&admin_address, &group_id, &member_address);

// Assign moderator role
client.assign_role(
    &admin_address,
    &group_id,
    &member_address,
    &Role::Moderator
);

// Get group info
let group_info = client.get_group_info(&group_id).unwrap();
println!("Member count: {}", group_info.member_count);

// List all members
let members = client.get_group_members(&group_id);
```

## Security Considerations

1. **Authorization**: All state-changing functions require proper authentication
2. **Role Enforcement**: Strict role hierarchy prevents privilege escalation
3. **Admin Protection**: Admin cannot be removed by others
4. **Capacity Limits**: Groups enforce maximum member limits
5. **State Validation**: Operations on dissolved groups are prevented

## Storage

The contract uses Stellar's persistent storage with the following keys:

- `GROUP`: Group records indexed by GroupId
- `MEMBER`: Member records indexed by (GroupId, Address)
- `MEMLIST`: Member lists indexed by GroupId
- `COUNTER`: Global counter for generating unique GroupIds

All storage entries have extended TTL (100,000 ledgers) for long-term persistence.

## License

MIT
