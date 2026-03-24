# Access Control & Admin Module Implementation

closes #375

## Overview

This PR implements a centralized, role-based access control system across all Gasless Gossip Soroban contracts using Soroban's auth framework. The implementation provides a flexible, reusable access control library that can be integrated into any contract.

## Changes Summary

### 1. New Access Control Module (`gasless-common/src/access_control.rs`)

A comprehensive shared library providing:

#### Role Definitions
- **SUPER_ADMIN**: Full system access, can manage all roles and emergency pause
- **PLATFORM_ADMIN**: Platform-level administrative access
- **CONTRACT_ADMIN**: Contract-specific administrative access
- **MODERATOR**: Moderation and monitoring capabilities

#### Core Functions

**Role Management:**
- `grant_role(role, address, caller)` - Grant a role to an address (SUPER_ADMIN only)
- `revoke_role(role, address, caller)` - Revoke a role from an address (SUPER_ADMIN only)
- `has_role(role, address) -> bool` - Check if an address has a specific role
- `require_role(role, caller)` - Auth guard that enforces role requirement

**Two-Step Role Transfer (Prevents Accidental Loss):**
- `initiate_role_transfer(role, from, to, caller)` - Initiate a role transfer
- `accept_role_transfer(role, from, caller)` - Accept a pending role transfer
- `reject_role_transfer(role, from, caller)` - Reject a pending role transfer

**Emergency Pause Mechanism:**
- `activate_emergency_pause(caller)` - Activate emergency pause (SUPER_ADMIN only)
- `deactivate_emergency_pause(caller)` - Deactivate emergency pause (SUPER_ADMIN only)
- `is_emergency_paused() -> bool` - Check pause status
- `require_not_paused()` - Auth guard that enforces non-paused state

**Initialization:**
- `init_access_control(admin)` - Initialize access control with initial admin

#### Event Emission
All access control changes emit events for audit trail:
- `role_granted` - When a role is granted
- `role_revoked` - When a role is revoked
- `role_transfer_initiated` - When a role transfer is initiated
- `role_transfer_accepted` - When a role transfer is accepted
- `role_transfer_rejected` - When a role transfer is rejected
- `emergency_pause_activated` - When emergency pause is activated
- `emergency_pause_deactivated` - When emergency pause is deactivated

#### Testing
- 13 comprehensive unit tests covering all role scenarios
- Tests for role granting/revoking
- Tests for two-step transfer acceptance/rejection
- Tests for emergency pause activation/deactivation
- All tests passing

### 2. Token Contract Integration (`contracts/token/src/lib.rs`)

**Changes:**
- Initialize access control during token setup
- Add access control functions: `grant_role`, `revoke_role`, `has_role`
- Add role transfer functions: `initiate_role_transfer`, `accept_role_transfer`, `reject_role_transfer`
- Add emergency pause functions: `activate_emergency_pause`, `deactivate_emergency_pause`, `is_emergency_paused`
- Enhanced registry operations with role-based permission checks

**Impact:**
- All existing tests still passing (10 tests)
- Backward compatible with existing functionality

### 3. DAO Treasury Contract Integration (`contracts/dao_treasury/src/lib.rs`)

**Changes:**
- Initialize access control during treasury setup
- Add access control functions: `grant_role`, `revoke_role`, `has_role`
- Add role transfer functions: `initiate_role_transfer`, `accept_role_transfer`, `reject_role_transfer`
- Add emergency pause functions: `activate_emergency_pause`, `deactivate_emergency_pause`, `is_emergency_paused`

**Impact:**
- All existing tests still passing (5 tests)
- Backward compatible with existing functionality

### 4. Contact Management Contract Integration (`contracts/contact_management/src/lib.rs`)

**Changes:**
- Initialize access control during contract setup
- Add access control functions: `grant_role`, `revoke_role`, `has_role`
- Add role transfer functions: `initiate_role_transfer`, `accept_role_transfer`, `reject_role_transfer`
- Add emergency pause functions: `activate_emergency_pause`, `deactivate_emergency_pause`, `is_emergency_paused`

**Impact:**
- All existing tests still passing (6 tests)
- Backward compatible with existing functionality

## Acceptance Criteria Met

✅ **Role checks applied consistently across all contracts**
- All contracts initialize access control with SUPER_ADMIN role
- Consistent role-based permission model across token, DAO, and contact management

✅ **Two-step role transfer prevents accidental loss of admin**
- `initiate_role_transfer` starts the process
- `accept_role_transfer` completes the transfer only when recipient accepts
- `reject_role_transfer` allows rejection of pending transfers
- Original role holder retains role until transfer is accepted

✅ **Emergency pause halts non-admin contract operations**
- `activate_emergency_pause` can only be called by SUPER_ADMIN
- `is_emergency_paused` provides pause status check
- `require_not_paused` auth guard prevents operations when paused

✅ **Role hierarchy enforced (super admin can manage all)**
- SUPER_ADMIN can grant/revoke any role
- Only SUPER_ADMIN can activate/deactivate emergency pause
- Role transfer requires either role holder or SUPER_ADMIN

✅ **Events emitted for all access control changes**
- `role_granted` event on role grant
- `role_revoked` event on role revoke
- `role_transfer_initiated`, `role_transfer_accepted`, `role_transfer_rejected` events
- `emergency_pause_activated`, `emergency_pause_deactivated` events

## Testing

**Total Tests: 52 (all passing)**
- Access Control Module: 13 tests
- Contact Management: 6 tests
- DAO Treasury: 5 tests
- Hello World: 2 tests
- Token Contract: 10 tests
- Integration Tests: 4 tests
- Gasless Common: 12 tests

**Build Status:** ✅ All contracts compile successfully to WASM

## Architecture Highlights

1. **Centralized Library**: Access control logic lives in `gasless-common`, promoting code reuse
2. **Flexible Role System**: Symbol-based roles allow for easy extension
3. **Storage Efficient**: Uses persistent storage for role mappings
4. **Event-Driven**: All changes emit events for audit trails
5. **Two-Step Transfers**: Prevents accidental loss of critical roles
6. **Emergency Pause**: System-wide pause capability for critical situations

## Backward Compatibility

All changes are backward compatible:
- Existing contract functions unchanged
- New access control functions are additive
- All existing tests pass without modification
- No breaking changes to contract interfaces

## Future Enhancements

Potential improvements for future iterations:
1. Role hierarchy with inheritance (e.g., SUPER_ADMIN inherits PLATFORM_ADMIN permissions)
2. Time-locked role transfers for additional security
3. Multi-sig approval for critical role changes
4. Role expiration and renewal mechanisms
5. Granular permission matrix for fine-grained access control

## Commits

1. `feat: add access control module to gasless-common` - Core access control library
2. `feat: integrate access control into token contract` - Token contract integration
3. `feat: integrate access control into DAO treasury contract` - DAO treasury integration
4. `feat: integrate access control into contact management contract` - Contact management integration

## Files Modified

- `contracts/gasless-common/src/lib.rs` - Added access_control module export
- `contracts/gasless-common/src/access_control.rs` - New access control module (548 lines)
- `contracts/contracts/token/src/lib.rs` - Added access control integration
- `contracts/contracts/dao_treasury/src/lib.rs` - Added access control integration
- `contracts/contracts/contact_management/src/lib.rs` - Added access control integration

## Verification

To verify the implementation:

```bash
# Run all tests
cargo test

# Build all contracts
cargo build --target wasm32-unknown-unknown --release

# Run specific access control tests
cargo test --lib access_control
```

All tests pass and all contracts build successfully.
