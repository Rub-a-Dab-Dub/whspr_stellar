#!/usr/bin/env bash
set -e

CONTRACT_WASM=target/wasm32-unknown-unknown/release/soroban_base_contract.wasm
NETWORK=testnet
RPC_URL=https://soroban-testnet.stellar.org

echo "🚀 Deploying contract to Stellar Testnet..."

soroban contract deploy \
  --wasm $CONTRACT_WASM \
  --network $NETWORK \
  --rpc-url $RPC_URL \
  --source-account default

echo "✅ Deployment successful"
