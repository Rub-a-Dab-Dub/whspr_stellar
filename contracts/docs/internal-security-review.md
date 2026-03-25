# Internal Security Review Findings

## Reviewed Components

- `contracts/contracts/token/src/lib.rs`
- `contracts/contracts/hello_world/src/lib.rs`
- Deployment workflows and scripts under `.github/workflows` and `contracts/scripts`

## Findings and Fixes

### High: Missing checked arithmetic in token balance updates

- **Status:** Fixed
- **Fix:** Replaced direct `+`/`-` with `checked_add` and `checked_sub`, returning explicit contract errors.

### High: Missing explicit input validation on state-changing entrypoints

- **Status:** Fixed
- **Fix:** Added validation for:
  - token decimals range
  - metadata name/symbol bounds
  - positive transfer/mint amounts

### Medium: Sensitive operations lacked abuse throttling

- **Status:** Fixed
- **Fix:** Added per-actor rate limiting for `mint` and `transfer`.

### Medium: Reentrancy guard pattern absent

- **Status:** Fixed
- **Fix:** Added instance-level reentrancy lock and guard wrapper around sensitive state mutation functions.

### Medium: Initialization auth not explicit

- **Status:** Fixed
- **Fix:** Added explicit `admin.require_auth()` in `initialize`.

### Low: Storage key domain broadening needed

- **Status:** Fixed
- **Fix:** Added dedicated key variants for `LastMintAt`, `LastTransferAt`, and `ReentrancyLock`.

## Unresolved Critical/High Findings

None.
