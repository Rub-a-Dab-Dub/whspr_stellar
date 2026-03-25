# Contract Upgrade & Migration Guide

This guide describes the safe contract upgrade and state migration pattern implemented for all Gasless Gossip Soroban contracts.

## Overview

The upgrade system provides:

- **Multi-sig approval** for contract upgrades
- **State migration** with schema versioning
- **Pre-upgrade validation** to ensure contract integrity
- **Post-upgrade verification** to confirm successful upgrade
- **Dry-run simulation** for testing upgrades before execution
- **Rollback capability** within TTL window
- **Event emission** for audit trail

## Architecture

### Core Components

1. **Upgrade Module** (`gasless-common/src/upgrade.rs`)
   - Version tracking and history
   - WASM hash management
   - Multi-sig signer management
   - Upgrade snapshot recording

2. **Migration Module** (`gasless-common/src/migration.rs`)
   - Pre/post-upgrade validation
   - State integrity checks
   - Schema versioning utilities
   - Dry-run simulation

3. **Contract Functions**
   - `init_upgrade()` - Initialize upgrade infrastructure
   - `upgrade(new_wasm_hash)` - Execute contract upgrade
   - `migrate_state(from_version, to_version)` - Perform state migration
   - `verify_upgrade()` - Verify upgrade success

### Storage Keys

Upgrade state is stored in instance storage:

```rust
pub enum UpgradeKey {
    ContractVersion,           // Current version
    CurrentWasmHash,           // Current WASM hash
    PreviousWasmHash,          // Previous WASM for rollback
    UpgradeHistory(u32),       // Upgrade snapshots
    MigrationHistory(u32),     // Migration records
    UpgradeCount,              // Total upgrades
    MigrationCount,            // Total migrations
    MultiSigSigners,           // Authorized signers
    MultiSigThreshold,         // Required approvals
    UpgradeApprovalVotes,      // Pending votes
    PendingUpgradeHash,        // Pending upgrade hash
}
```

## Upgrade Process

### 1. Pre-Upgrade Checks

Before any upgrade, the system validates:

- Contract is initialized
- No active reentrancy locks
- Admin authorization
- Multi-sig approval (if configured)

### 2. Upgrade Execution

```bash
# Build new WASM
make build

# Install WASM code
stellar contract install \
  --network testnet \
  --source-account deployer \
  --wasm out/my-contract.wasm

# Invoke upgrade function
stellar contract invoke \
  --network testnet \
  --source-account deployer \
  --id CXXX... \
  -- \
  upgrade \
  --new_wasm_hash <hash>
```

### 3. State Migration

If state schema changed, run migration:

```bash
stellar contract invoke \
  --network testnet \
  --source-account deployer \
  --id CXXX... \
  -- \
  migrate_state \
  --from_version 1 \
  --to_version 2
```

### 4. Post-Upgrade Verification

Verify upgrade success:

```bash
stellar contract invoke \
  --network testnet \
  --source-account deployer \
  --id CXXX... \
  -- \
  verify_upgrade
```

## Safe Upgrade Script

Use the provided safe upgrade script for automated validation:

```bash
# Dry-run (no changes)
bash scripts/upgrade-contract-safe.sh \
  --network testnet \
  --source-account deployer \
  --contract-id CXXX... \
  --wasm out/my-contract.wasm \
  --dry-run

# With state snapshot
bash scripts/upgrade-contract-safe.sh \
  --network testnet \
  --source-account deployer \
  --contract-id CXXX... \
  --wasm out/my-contract.wasm \
  --snapshot

# With migration
bash scripts/upgrade-contract-safe.sh \
  --network testnet \
  --source-account deployer \
  --contract-id CXXX... \
  --wasm out/my-contract.wasm \
  --migration-function migrate_state_v1_to_v2
```

## Multi-Sig Approval

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

### Approval Flow

1. Admin initiates upgrade
2. Multi-sig signers review
3. Threshold number of signers approve
4. Upgrade executes

## State Migration

### Schema Versioning

Contracts track schema versions:

```rust
pub struct SchemaVersion {
    pub major: u32,  // Breaking changes
    pub minor: u32,  // New fields
    pub patch: u32,  // Bug fixes
}
```

### Migration Path

Versions must be sequential:

```
v1 -> v2 -> v3 (allowed)
v1 -> v3 (not allowed, must go through v2)
```

### Custom Migrations

Implement contract-specific migrations:

```rust
pub fn migrate_state_v1_to_v2(env: Env) -> Result<(), ContractError> {
    // 1. Validate pre-migration state
    migration::validate_pre_upgrade(&env)?;
    
    // 2. Transform data
    // - Add new fields with defaults
    // - Rename existing fields
    // - Consolidate data structures
    
    // 3. Verify integrity
    migration::verify_post_upgrade(&env)?;
    
    Ok(())
}
```

## Rollback Procedure

### Rollback Within TTL

If upgrade fails, rollback to previous version:

```bash
bash scripts/rollback-contract.sh \
  --network testnet \
  --source-account deployer \
  --contract-id CXXX... \
  --previous-wasm-hash <old_hash>
```

### Rollback Limitations

- Only possible within TTL window (configurable)
- Requires admin authorization
- State changes are NOT rolled back (only code)
- Manual state restoration may be needed

## Event Emission

Upgrade events are emitted for audit trail:

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

## Best Practices

### Before Upgrade

1. ✅ Test on local testnet first
2. ✅ Run dry-run simulation
3. ✅ Create state snapshot
4. ✅ Review migration logic
5. ✅ Get multi-sig approvals
6. ✅ Notify users of maintenance window

### During Upgrade

1. ✅ Monitor contract events
2. ✅ Verify post-upgrade checks pass
3. ✅ Test critical functions
4. ✅ Check state integrity

### After Upgrade

1. ✅ Run health checks
2. ✅ Monitor for errors
3. ✅ Archive upgrade snapshot
4. ✅ Document changes
5. ✅ Update deployment registry

## Troubleshooting

### Upgrade Fails

```bash
# Check contract state
stellar contract invoke \
  --network testnet \
  --source-account deployer \
  --id CXXX... \
  -- \
  get_upgrade_info

# Verify multi-sig setup
stellar contract invoke \
  --network testnet \
  --source-account deployer \
  --id CXXX... \
  -- \
  get_multi_sig_signers
```

### Migration Fails

1. Check pre-upgrade validation
2. Verify state schema compatibility
3. Review migration logic for errors
4. Consider rollback if critical

### State Corruption

1. Rollback to previous version
2. Restore from snapshot if available
3. Investigate root cause
4. Plan corrective migration

## Examples

### Token Contract Upgrade

```bash
# Build new token contract
make build

# Get new WASM hash
NEW_HASH=$(stellar contract install \
  --network testnet \
  --source-account deployer \
  --wasm out/whspr-token.wasm | tail -1)

# Upgrade token contract
stellar contract invoke \
  --network testnet \
  --source-account deployer \
  --id CTOKEN... \
  -- \
  upgrade \
  --new_wasm_hash "${NEW_HASH}"

# Verify
stellar contract invoke \
  --network testnet \
  --source-account deployer \
  --id CTOKEN... \
  -- \
  verify_upgrade
```

### DAO Treasury Upgrade with Migration

```bash
# Upgrade DAO treasury
bash scripts/upgrade-contract-safe.sh \
  --network testnet \
  --source-account deployer \
  --contract-id CDAO... \
  --wasm out/dao-treasury.wasm \
  --migration-function migrate_state \
  --snapshot
```

## References

- [Soroban Upgrade Mechanism](https://developers.stellar.org/docs/learn/soroban/contract-upgrades)
- [Multi-Sig Patterns](https://developers.stellar.org/docs/learn/soroban/patterns/multi-sig)
- [State Management](https://developers.stellar.org/docs/learn/soroban/state-management)
