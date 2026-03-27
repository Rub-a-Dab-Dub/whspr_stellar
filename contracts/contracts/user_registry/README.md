# User Registry Contract

On-chain user registry contract that maps Stellar wallet addresses to Gasless Gossip usernames and public identity metadata.

## Features

- **User Registration**: Register wallet addresses with unique usernames and public keys
- **Username Resolution**: Bidirectional mapping between addresses and usernames
- **Profile Management**: Update display names and avatar hashes
- **Account Deactivation**: Users can deactivate their accounts, admins can override
- **Username Uniqueness**: Enforced at the contract level
- **Event Emission**: All state changes emit events for off-chain indexing

## Storage Schema

The contract uses the following storage structure:

```rust
pub enum DataKey {
    Admin,                          // Contract admin address
    User(Address),                  // UserRecord for an address
    UsernameToAddress(Symbol),      // Address lookup by username
    UserCount,                      // Total registered users
}

pub struct UserRecord {
    pub address: Address,           // User's wallet address
    pub username: Symbol,           // Unique username
    pub public_key: BytesN<32>,     // Public key for identity
    pub display_name: Option<Symbol>,    // Optional display name
    pub avatar_hash: Option<BytesN<32>>, // Optional avatar hash
    pub registered_at: u64,         // Registration timestamp
    pub updated_at: u64,            // Last update timestamp
    pub is_active: bool,            // Account status
}
```

## Functions

### Initialization

#### `initialize(admin: Address)`

Initialize the contract with an admin address. Can only be called once.

### User Registration

#### `register(address: Address, username: Symbol, public_key: BytesN<32>)`

Register a new user with a unique username and public key.

**Requirements:**

- User must not already be registered
- Username must not be taken
- Public key must not be all zeros
- Caller must be the address being registered

**Emits:** `user_reg` event

### Profile Management

#### `update_profile(address: Address, display_name: Option<Symbol>, avatar_hash: Option<BytesN<32>>)`

Update user profile with display name and/or avatar hash.

**Requirements:**

- User must be registered
- Account must be active
- Caller must be the address being updated

**Emits:** `prof_upd` event

### Queries

#### `get_user(address: Address) -> UserRecord`

Get user record by address.

#### `resolve_username(username: Symbol) -> Address`

Resolve username to address.

#### `is_username_available(username: Symbol) -> bool`

Check if a username is available for registration.

#### `get_user_count() -> u64`

Get total number of registered users.

### Account Management

#### `deactivate_account(address: Address)`

Deactivate the caller's account.

**Requirements:**

- User must be registered
- Account must be active
- Caller must be the address being deactivated

**Emits:** `acc_deac` event

#### `admin_deactivate_account(admin: Address, target: Address)`

Admin override to deactivate any account.

**Requirements:**

- Caller must be the contract admin
- Target user must be registered
- Target account must be active

**Emits:** `acc_deac` event

### Admin Functions

#### `get_admin() -> Address`

Get the admin address.

## Events

### `user_reg` (User Registered)

Emitted when a new user registers.

- Topic: `(symbol_short!("user_reg"), address)`
- Data: `(username, public_key, timestamp)`

### `prof_upd` (Profile Updated)

Emitted when a user updates their profile.

- Topic: `(symbol_short!("prof_upd"), address)`
- Data: `(display_name, avatar_hash, timestamp)`

### `acc_deac` (Account Deactivated)

Emitted when an account is deactivated.

- Topic: `(symbol_short!("acc_deac"), address)`
- Data: `(username, timestamp)`

## Error Codes

| Code | Error                 | Description                  |
| ---- | --------------------- | ---------------------------- |
| 1    | AlreadyInitialized    | Contract already initialized |
| 2    | NotInitialized        | Contract not initialized     |
| 3    | Unauthorized          | Caller not authorized        |
| 4    | UserNotFound          | User not found               |
| 5    | UsernameTaken         | Username already taken       |
| 6    | InvalidUsername       | Invalid username format      |
| 7    | UserAlreadyRegistered | User already registered      |
| 8    | AccountDeactivated    | Account is deactivated       |
| 9    | InvalidPublicKey      | Invalid public key           |
| 10   | InvalidDisplayName    | Invalid display name         |
| 11   | InvalidAvatarHash     | Invalid avatar hash          |

## Building

```bash
cd contracts/contracts/user_registry
cargo build --target wasm32-unknown-unknown --release
```

## Testing

### Unit Tests

```bash
cargo test
```

### Integration Tests

```bash
cargo test --test integration_test
```

## Deployment

```bash
# Build the contract
make build-user-registry

# Deploy to testnet
./scripts/deploy-contract.sh user_registry testnet

# Deploy to mainnet
./scripts/deploy-contract.sh user_registry mainnet
```

## Usage Example

```rust
use soroban_sdk::{symbol_short, Address, BytesN, Env};

// Initialize contract
let admin = Address::generate(&env);
client.initialize(&admin);

// Register user
let user = Address::generate(&env);
let username = symbol_short!("alice");
let public_key = BytesN::from_array(&env, &[1u8; 32]);
client.register(&user, &username, &public_key);

// Update profile
let display_name = Some(symbol_short!("Alice"));
let avatar_hash = Some(BytesN::from_array(&env, &[99u8; 32]));
client.update_profile(&user, &display_name, &avatar_hash);

// Resolve username
let resolved_address = client.resolve_username(&username);
assert_eq!(resolved_address, user);

// Deactivate account
client.deactivate_account(&user);
```

## Security Considerations

1. **Username Uniqueness**: Enforced at contract level to prevent conflicts
2. **Authorization**: All state-changing operations require caller authentication
3. **Admin Powers**: Admin can deactivate any account (use with caution)
4. **Deactivation**: Deactivated accounts cannot update profiles but data remains accessible
5. **Public Keys**: Validated to prevent zero-key registrations
6. **Storage TTL**: Records persist for ~180 days and are automatically extended on access

## License

See project root LICENSE file.
