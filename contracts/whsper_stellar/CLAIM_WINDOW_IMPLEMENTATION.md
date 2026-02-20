# Claim Window Configuration Implementation

## Overview

This document describes the implementation of claim window configuration storage and data structures for issue #173.

## Changes Made

### 1. New Types in `src/types.rs`

#### ClaimWindowConfig Struct

```rust
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ClaimWindowConfig {
    pub claim_validity_ledgers: u64,  // Number of ledgers before claim expiry
    pub enabled: bool,                 // Feature toggle for claim window functionality
}
```

**Purpose**: Configuration structure to control claim window behavior for token transfers and room entry fees.

#### New ContractError Variants

```rust
ClaimExpired = 30,           // Claim has expired and can no longer be processed
ClaimAlreadyProcessed = 31,  // Claim has already been processed
```

**Purpose**: Provide specific error handling for claim-related operations.

### 2. New Storage Keys in `src/storage.rs`

#### ClaimWindowConfig

- **Key**: `ClaimWindowConfig`
- **Type**: Stores `ClaimWindowConfig` struct
- **Purpose**: Persistent storage for claim window configuration

#### PendingClaim(u64)

- **Key**: `PendingClaim(claim_id)`
- **Type**: Parameterized by claim ID
- **Purpose**: Track pending claims that haven't been processed yet

#### NextClaimId

- **Key**: `NextClaimId` (already existed)
- **Type**: `u64`
- **Purpose**: Auto-incrementing counter for generating unique claim IDs

### 3. Additional Types Added

#### Invitation Struct

```rust
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Invitation {
    pub id: u64,
    pub room_id: u64,
    pub inviter: Address,
    pub invitee: Address,
    pub created_at: u64,
    pub expires_at: u64,
    pub max_uses: Option<u32>,
    pub use_count: u32,
    pub is_revoked: bool,
}
```

#### InvitationStatus Enum

```rust
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum InvitationStatus {
    Pending = 0,
    Accepted = 1,
    Expired = 2,
    Revoked = 3,
}
```

**Note**: These types were missing from the codebase but were referenced in `lib.rs`.

### 4. Storage.rs Cleanup

Fixed the `Tip` struct which had incorrectly placed fields. The corrected structure:

```rust
#[contracttype]
pub struct Tip {
    pub id: u64,
    pub sender: Address,
    pub receiver: Address,
    pub amount: i128,
    pub fee: i128,
    pub message_id: u64,
    pub timestamp: u64,
}
```

All the tip-related storage keys were moved to the `DataKey` enum where they belong.

## Acceptance Criteria Met

✅ **New types compile without errors**: All structs use proper Soroban SDK annotations (`#[contracttype]`, `#[contracterror]`)

✅ **Storage keys are properly defined**:

- `ClaimWindowConfig` - for configuration storage
- `PendingClaim(u64)` - for tracking pending claims by ID
- `NextClaimId` - for claim ID generation (already existed)

✅ **Error types are documented**:

- `ClaimExpired` - for expired claims
- `ClaimAlreadyProcessed` - for already processed claims

## Usage Example

```rust
// Initialize claim window configuration
let config = ClaimWindowConfig {
    claim_validity_ledgers: 17280, // ~24 hours at 5s per ledger
    enabled: true,
};
env.storage().instance().set(&DataKey::ClaimWindowConfig, &config);

// Create a new claim
let claim_id = next_claim_id(&env);
env.storage().instance().set(&DataKey::PendingClaim(claim_id), &claim);

// Check if claim window is enabled
let config: ClaimWindowConfig = env
    .storage()
    .instance()
    .get(&DataKey::ClaimWindowConfig)
    .unwrap_or(ClaimWindowConfig {
        claim_validity_ledgers: 17280,
        enabled: false,
    });
```

## Next Steps

These foundational types enable the implementation of:

1. Token transfer claim windows
2. Room entry fee claim mechanisms
3. Claim expiration logic based on ledger count
4. Feature toggling for claim functionality

## Files Modified

- `contracts/whsper_stellar/src/types.rs` - Added `ClaimWindowConfig`, error variants, `Invitation`, and `InvitationStatus`
- `contracts/whsper_stellar/src/storage.rs` - Added storage keys and fixed `Tip` struct
