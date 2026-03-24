#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${ROOT_DIR}/target/wasm32-unknown-unknown/release"
OUT_DIR="${ROOT_DIR}/out"

echo "==> Building contracts for wasm32-unknown-unknown"
cargo build --manifest-path "${ROOT_DIR}/Cargo.toml" --target wasm32-unknown-unknown --release

mkdir -p "${OUT_DIR}"
rm -f "${OUT_DIR}"/*.wasm

echo "==> Collecting wasm artifacts in ${OUT_DIR}"
shopt -s nullglob
for wasm in "${TARGET_DIR}"/*.wasm; do
  cp "${wasm}" "${OUT_DIR}/"
  echo "  -> $(basename "${wasm}")"
done
shopt -u nullglob

if ! ls "${OUT_DIR}"/*.wasm >/dev/null 2>&1; then
  echo "No wasm artifacts were produced."
  exit 1
fi

echo "==> Build complete"
