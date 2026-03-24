# Rollback Procedure

This document defines the rollback process for Soroban contract deployments.

## Preconditions

- You have the previous known-good wasm hash.
- The deployed contract supports an `upgrade(new_wasm_hash)` entrypoint.
- Deployment account has admin authorization to execute upgrade.

## Dry-run Test (CI validated)

The rollback path is validated on every contracts test workflow using:

```bash
bash scripts/rollback-contract.sh \
  --network testnet \
  --source-account ci-testnet \
  --contract-id CTEST_CONTRACT_ID \
  --previous-wasm-hash 0000000000000000000000000000000000000000000000000000000000000000 \
  --dry-run
```

## Execute Rollback

```bash
bash scripts/rollback-contract.sh \
  --network <testnet|mainnet> \
  --source-account <deployer-alias> \
  --contract-id <contract_id> \
  --previous-wasm-hash <wasm_hash>
```

## Post-rollback Validation

Run health checks immediately after rollback:

```bash
bash scripts/verify-deployment.sh \
  --network <testnet|mainnet> \
  --source-account <deployer-alias> \
  --registry deployments/registry.json
```

## Incident Notes

For every rollback, capture:

- Trigger (what failed)
- Affected contracts and ids
- Previous and new wasm hashes
- Validation output from health checks
- Follow-up action items
