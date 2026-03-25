# Audit Package

This package enumerates artifacts prepared for external audit.

## Code

- Contracts:
  - `contracts/contracts/hello_world`
  - `contracts/contracts/token`
- Deployment and operations scripts:
  - `contracts/scripts`
- CI/CD:
  - `.github/workflows/contracts-*.yml`

## Security Documentation

- Threat model: `docs/threat-model.md`
- Internal review findings: `docs/internal-security-review.md`
- Deployment runbook: `docs/deployment-runbook.md`
- Rollback process: `docs/rollback-procedure.md`

## Test & Verification Commands

Run from `contracts/`:

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --target wasm32-unknown-unknown --release
```

Coverage generation command (for audit evidence in CI artifacts):

```bash
cargo tarpaulin --out Xml --output-dir target-tarpaulin
```

> Target coverage for audit sign-off: >=90% on contract crates.

## Security Controls Checklist

- [x] Explicit auth on all state-changing entrypoints
- [x] Checked arithmetic for state-changing math paths
- [x] Entry-point input validation
- [x] Reentrancy guard pattern on sensitive operations
- [x] Sensitive operation rate limiting
- [x] Versioned deployment registry and rollback documentation
