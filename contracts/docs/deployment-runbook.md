# Contract Deployment Runbook

This runbook describes the automated deployment flow and manual operating procedure for Soroban contracts in this repository.

## Environments

- `develop` branch -> automatic **testnet** deployment
- `main` (or selected ref) -> manual **mainnet** deployment with approval gate

## CI/CD Workflow Chain

1. **Contracts Build** (`contracts-build.yml`)
   - `cargo fmt --check`
   - `cargo clippy --all-targets -- -D warnings`
   - wasm build artifacts
2. **Contracts Test** (`contracts-test.yml`)
   - `cargo test`
   - rollback script dry-run validation
3. **Contracts Deploy Testnet** (`contracts-deploy-testnet.yml`)
   - runs automatically after test workflow succeeds on `develop`
   - provisions/funds CI key via friendbot
   - deploys all wasm contracts
   - verifies post-deploy health checks
   - updates `deployments/registry.json`
4. **Contracts Deploy Mainnet** (`contracts-deploy-mainnet.yml`)
   - `workflow_dispatch` only
   - protected by GitHub `mainnet` environment approval
   - deploys + verifies + updates registry

## Required Secrets and Environment Configuration

### GitHub Environments

- Create environment: `mainnet`
- Enable required reviewers (manual approval gate)

### GitHub Secrets

- `MAINNET_SECRET_KEY` (required for mainnet deploy)

## Local Operator Commands

From `contracts/`:

```bash
# Build and deploy all contracts to testnet
bash scripts/deploy-all.sh --network testnet --source-account my-testnet-key

# Verify latest deployed contracts
bash scripts/verify-deployment.sh --network testnet --source-account my-testnet-key
```

## Registry Management

Deployment script updates `deployments/registry.json` automatically:

- `networks.<network>.latest` contains current active contract ids
- `networks.<network>.history` stores versioned deployment history entries
- `version` increments on every deployment

## Health Checks

Post-deploy verification runs:

- `hello_world::hello(to)`
- `whspr_token::balance(addr)`

Any failed call marks deployment as failed.
