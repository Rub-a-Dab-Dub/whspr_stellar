# Cross-Contract Call Patterns

This workspace centralizes shared cross-contract behavior in `gasless-common`.

## Shared Crate Layout

- `gasless-common::types`
  - `SharedAddress`
  - `ConversationId`
  - `GroupId`
  - `TokenAmount`
- `gasless-common::CommonError`
  - Shared error hierarchy used across contracts
- `gasless-common::registry`
  - Registry helpers for contract address and version storage
- `gasless-common::clients`
  - Contract client traits and invocation helpers
- `gasless-common::versioning`
  - Compatibility checks for API versions
- `gasless-common::events`
  - Shared event schema structure

## Client Trait Definitions

Cross-contract clients are declared in `gasless-common` using Soroban client macros:

- `HelloWorldContractClientTrait`
- `WhsprTokenContractClientTrait`

These generate concrete clients used by invocation helpers.

## Registry-Driven Lookup Pattern

1. Contract stores remote contract address + version in registry:
   - `registry::set_contract(env, key, address, version)`
2. Caller resolves target dynamically:
   - `registry::get_contract(env, key)`
3. Caller validates compatible version range:
   - `versioning::ensure_compatible(actual, min, max)`
4. Caller executes cross-contract invocation using generated client.

## Concrete Pattern in `whspr-token`

- `set_contract_registry_entry(...)`
  - Admin-authenticated write to registry
- `hello_from_registry(...)`
  - Resolves `hello` contract from registry
  - Enforces strict API compatibility
  - Executes the cross-contract call

## Failure Semantics

- Missing registry entries -> `CommonError::RegistryNotFound`
- Version incompatibility -> `CommonError::VersionMismatch`
- These errors are propagated through contract result types so callers can handle them consistently.
