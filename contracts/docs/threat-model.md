# Soroban Contracts Threat Model

## Scope

Contracts in scope:

- `contracts/hello_world`
- `contracts/token` (`WhsprToken`)

Primary assets:

- Token balances in persistent storage
- Contract admin authority
- Contract upgrade authority (if exposed by future versions)

## Trust Boundaries

- External callers invoke contract entrypoints with arbitrary input.
- Authorized signer identity is derived by Soroban auth checks.
- Ledger time is trusted only as provided by the network consensus layer.

## Attack Surface

### 1) Unauthorized state transitions

- **Vector:** Call state-changing entrypoints without auth.
- **Mitigation:** Explicit `require_auth()` in `initialize`, `mint`, `transfer`.
- **Residual risk:** Misconfigured admin key management outside contract.

### 2) Arithmetic safety failures

- **Vector:** Overflow/underflow in balance math causes wraparound.
- **Mitigation:** `checked_add`/`checked_sub`, explicit `InvalidAmount`, `Overflow`, `Underflow` errors.
- **Residual risk:** None for current arithmetic paths.

### 3) Input abuse / malformed params

- **Vector:** Invalid token metadata, zero/negative token amounts.
- **Mitigation:** Decimal bounds (1..=18), bounded name/symbol lengths, positive amount checks.
- **Residual risk:** Metadata semantics are still app-level policy.

### 4) Transaction spam on sensitive operations

- **Vector:** Rapid mint/transfer bursts to stress state transitions.
- **Mitigation:** Per-actor rate limit window on mint and transfer.
- **Residual risk:** Throughput trade-off can impact high-frequency legitimate workflows.

### 5) Reentrancy-style nested state mutation

- **Vector:** Nested invocation path attempts to mutate guarded functions.
- **Mitigation:** Reentrancy lock in instance storage wrapped around sensitive writes.
- **Residual risk:** Current contracts make no external contract calls, so practical risk is low.

### 6) Storage key confusion / accidental overwrite

- **Vector:** Colliding state domains for different control fields.
- **Mitigation:** Strongly typed `DataKey` namespace split for admin, balances, rate limits, and lock.
- **Residual risk:** Future key additions must preserve domain separation.

## Security Assumptions

- Soroban host enforces auth signature validity.
- Failed invocations are atomic and revert state.
- Deployment pipelines protect secrets and use branch/environment controls.

## Recommended Ongoing Controls

- Keep admin keys in hardware-backed or managed secret stores.
- Run static checks (`fmt`, `clippy -D warnings`) and tests on every PR.
- Run periodic manual abuse tests around rate-limiting boundaries.
