#!/usr/bin/env bash
set -e

echo "🔨 Building Soroban contract..."
cargo build --target wasm32-unknown-unknown --release

echo "✅ Build complete"
