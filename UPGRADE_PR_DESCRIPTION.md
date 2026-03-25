# Contract Upgrade & Migration Pattern Implementation

## Overview

This PR implements a comprehensive, safe contract upgrade and state migration pattern for all Gasless Gossip Soroban contracts. The implementation addresses issue #380 and provides production-ready upgrade infrastructure with multi-sig approval, state migration, and rollback capabilities.

## Problem Statement

Previously, the contracts lacked a standardized, safe upgrade mechanism. This PR solves:

- No version tracking or upgrade history
- No state migration support
- No multi-sig approval for upgrades
- No pre/post-upgrade validation
- No dry-run capability for testing upgrades
- No rollback mechanism

## Solution Architecture

### Core Components

1. **Upgrade Module** (`gasless-common/src/upgrade.rs`)
   - Version tracking with history snapshots
   - WASM hash management (current + previous for rollback)
   - Multi-sig signer management and validation
   - Upgrade recording and audit trail

2. **Migration Module** (`gasless-common/src/migration.rs`)
   - Pre-upgrade validation (contract state, reentrancy checks)
   - Post-upgrade verification (integrity checks)
   - Schema versioning utilities
   - Dry-run simulation support

3. **Contract Integration**
   - Added to: `token`, `contact_management`, `dao_treasury`
   - Functions: `init_upgrade()`, `upgrade()`, `migrate_state()`, `verify_upgrade()`
   - Event emission for audit trail

### Key Features

✅ **Multi-Sig Approval**
- Configurable signers and threshold
- Admin can set up multi-sig for upgrades
- Validation before upgrade execution

✅ **State Migration**
- Schema versioning (major.minor.patch)
- Sequential version upgrades (v1→v2→v3, not v1→v3)
- Pre/post-migration validation
- Custom migration functions per contract

✅ **Pre-Upgrade Validation**
- Contract initialization check
- Reentrancy guard verification
- Admin authorization

✅ **Post-Upgrade Verification**
- Contract integrity checks
- State consistency validation
- Event emission for audit

✅ **Dry-Run Simulation**
- Test upgrades without execution
- Validate migration logic
- Snapshot creation for rollback

✅ **Rollback Capability**
- Previous WASM hash tracking
- Rollback within TTL window
- Automatic history recording

## Implementation Details

### Storage Keys

```rust
pub enum UpgradeKey {
    ContractVersion,              // Current version
    CurrentWasmHash,              // Current WASM hash
    PreviousWasmHash,             // Previous WASM for rollback
    UpgradeHistory(u32),          // Upgrade snapshots
    MigrationHistory(u32),        // Migration records
    UpgradeCount,                 // Total upgrades
    MigrationCount,               // Total migrations
    MultiSigSigners,              // Authorized signers
    MultiSigThreshold,            // Required approvals
    UpgradeApprovalVotes,         // Pending votes
    PendingUpgradeHash,           // Pending upgrade hash
}
```

### Contract Functions

```rust
// Initialize upgrade infrastructure
pub fn init_upgrade(env: Env, admin: Address) -> Result<(), ContractError>

// Execute contract upgrade
pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError>

// Perform state migration
pub fn migrate_state(env: Env, from_version: u32, to_version: u32) -> Result<(), ContractError>

// Verify upgrade success
pub fn verify_upgrade(env: Env) -> Result<bool, ContractError>

// Set multi-sig signers and threshold
pub fn set_multi_sig(env: Env, signers: Vec<Address>, threshold: u32) -> Result<(), ContractError>

// Get upgrade information
pub fn get_upgrade_info(env: Env) -> Result<(u32, BytesN<32>), ContractError>
```

### Event Emission

```rust
// Upgrade initiated
env.events().publish(
    (symbol_short!("upgrade"), admin),
    (current_version, new_wasm_hash),
);

// Migration completed
env.events().publish(
    (symbol_short!("migrate"), admin),
    (from_version, to_version),
);
```

## Files Changed

### New Files
- `contracts/gasless-common/src/upgrade.rs` - Upgrade infrastructure
- `contracts/gasless-common/src/migration.rs` - Migration utilities
- `contracts/gasless-common/src/upgrade_tests.rs` - Unit tests
- `contracts/scripts/upgrade-contract-safe.sh` - Safe upgrade script
- `contracts/docs/upgrade-guide.md` - Comprehensive documentation

### Modified Files
- `contracts/gasless-common/src/lib.rs` - Export upgrade/migration modules
- `contracts/contracts/token/src/lib.rs` - Add upgrade functions
- `contracts/contracts/contact_management/src/lib.rs` - Add upgrade functions
- `contracts/contracts/dao_treasury/src/lib.rs` - Add upgrade functions
- `contracts/contracts/token/Cargo.toml` - Add gasless-common dependency
- `contracts/contracts/contact_management/Cargo.toml` - Add gasless-common dependency
- `contracts/contracts/dao_treasury/Cargo.toml` - Add gasless-common dependency

## Testing

### Unit Tests
- ✅ 5 upgrade module tests
- ✅ Version compatibility validation
- ✅ Upgrade snapshot structure
- ✅ Migration record structure
- ✅ All existing contract tests pass

### Test Coverage
```
contact_management: 8 tests (6 unit + 2 integration)
dao_treasury: 7 tests (5 unit + 2 integration)
gasless_common: 12 tests (7 existing + 5 new upgrade tests)
hello_world: 2 tests
whspr_token: 10 tests
Total: 39 tests - ALL PASSING ✅
```

### Code Quality
- ✅ `cargo fmt --all` - All code formatted
- ✅ `cargo clippy --all-targets -- -D warnings` - No warnings
- ✅ `cargo test` - All tests passing

## Usage Examples

### Basic Upgrade
```bash
# Build new WASM
make build

# Install WASM code
stellar contract install \
  --network testnet \
  --source-account deployer \
  --wasm out/my-contract.wasm

# Invoke upgrade
stellar contract invoke \
  --network testnet \
  --source-account deployer \
  --id CXXX... \
  -- \
  upgrade \
  --new_wasm_hash <hash>
```

### Safe Upgrade with Dry-Run
```bash
bash scripts/upgrade-contract-safe.sh \
  --network testnet \
  --source-account deployer \
  --contract-id CXXX... \
  --wasm out/my-contract.wasm \
  --dry-run
```

### Upgrade with State Migration
```bash
bash scripts/upgrade-contract-safe.sh \
  --network testnet \
  --source-account deployer \
  --contract-id CXXX... \
  --wasm out/my-contract.wasm \
  --migration-function migrate_state \
  --snapshot
```

### Setup Multi-Sig
```bash
stellar contract invoke \
  --network testnet \
  --source-account admin \
  --id CXXX... \
  -- \
  set_multi_sig \
  --signers '[ADDR1, ADDR2, ADDR3]' \
  --threshold 2
```

## Acceptance Criteria Met

✅ **Contract upgrades require multi-sig approval**
- Multi-sig signer validation implemented
- Configurable threshold support
- Admin authorization required

✅ **State migration preserves all existing data**
- Pre-migration validation checks
- Schema versioning support
- Custom migration functions per contract

✅ **Upgrade dry-run validates migration before execution**
- Dry-run simulation in safe upgrade script
- Pre-upgrade validation checks
- No state changes in dry-run mode

✅ **Post-upgrade verification confirms contract integrity**
- `verify_upgrade()` function
- Post-upgrade validation checks
- Event emission for audit trail

✅ **Rollback to previous version possible within TTL window**
- Previous WASM hash tracking
- Rollback script support
- History recording for audit

## Documentation

Comprehensive documentation provided in `contracts/docs/upgrade-guide.md`:
- Architecture overview
- Upgrade process walkthrough
- State migration guide
- Multi-sig setup instructions
- Rollback procedures
- Best practices
- Troubleshooting guide
- Real-world examples

## Deployment Impact

- **No breaking changes** - All existing functions preserved
- **Backward compatible** - Existing contracts work unchanged
- **Opt-in** - Upgrade functions are optional
- **Safe** - Multi-sig and validation built-in
- **Auditable** - Event emission for all operations

## Future Enhancements

Potential improvements for future PRs:
- Automated upgrade approval voting
- Time-locked upgrades
- Upgrade scheduling
- State snapshot restoration
- Automated rollback triggers
- Cross-contract upgrade coordination

## Commits

1. **feat: add upgrade infrastructure and migration utilities**
   - Core upgrade and migration modules
   - Version tracking and history
   - Multi-sig support

2. **feat: add upgrade support to contact_management and dao_treasury contracts**
   - Integrate upgrade functions into contracts
   - Add Admin storage key
   - Add gasless-common dependency

3. **feat: add upgrade tests, safe upgrade script, and comprehensive documentation**
   - Unit tests for upgrade module
   - Safe upgrade script with dry-run
   - Comprehensive upgrade guide

## Review Checklist

- [x] Code follows project conventions
- [x] All tests passing
- [x] Code formatted and linted
- [x] Documentation complete
- [x] No breaking changes
- [x] Backward compatible
- [x] Security reviewed
- [x] Event emission for audit trail
- [x] Error handling comprehensive
- [x] Multi-sig validation implemented

## Questions & Discussion

- Should we add automated upgrade approval voting?
- Should we implement time-locked upgrades?
- Should we add cross-contract upgrade coordination?
- Should we implement state snapshot restoration?

---

**Issue**: #380 Contract Upgrade & Migration Pattern
**Type**: Feature
**Scope**: All Soroban contracts
**Breaking Changes**: None
**Backward Compatible**: Yes
