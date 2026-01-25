# Soroban Base Contract

A minimal Soroban smart contract scaffold with initialization, storage, and testnet deployment.

## Prerequisites

- Rust (stable)
- Soroban CLI
- Funded Stellar testnet account

```bash
rustup target add wasm32-unknown-unknown
```

### Build
```
./scripts/build.sh
```

### Deploy to Testnet

```
./scripts/deploy_testnet.sh
```

### Initialize Contract

```
soroban contract invoke \
  --network testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --id <CONTRACT_ID> \
  -- metadata
```