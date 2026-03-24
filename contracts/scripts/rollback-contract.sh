#!/usr/bin/env bash
set -euo pipefail

NETWORK=""
SOURCE_ACCOUNT=""
CONTRACT_ID=""
PREVIOUS_WASM_HASH=""
DRY_RUN="false"

usage() {
  cat <<'EOF'
Usage:
  rollback-contract.sh --network <network> --source-account <alias> --contract-id <id> --previous-wasm-hash <hash> [--dry-run]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network)
      NETWORK="$2"
      shift 2
      ;;
    --source-account)
      SOURCE_ACCOUNT="$2"
      shift 2
      ;;
    --contract-id)
      CONTRACT_ID="$2"
      shift 2
      ;;
    --previous-wasm-hash)
      PREVIOUS_WASM_HASH="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift 1
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${NETWORK}" || -z "${SOURCE_ACCOUNT}" || -z "${CONTRACT_ID}" || -z "${PREVIOUS_WASM_HASH}" ]]; then
  usage
  exit 1
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[DRY RUN] stellar contract invoke --network ${NETWORK} --source-account ${SOURCE_ACCOUNT} --id ${CONTRACT_ID} -- upgrade --new_wasm_hash ${PREVIOUS_WASM_HASH}"
  exit 0
fi

echo "==> Rolling back contract ${CONTRACT_ID} to wasm hash ${PREVIOUS_WASM_HASH}"
stellar contract invoke \
  --network "${NETWORK}" \
  --source-account "${SOURCE_ACCOUNT}" \
  --id "${CONTRACT_ID}" \
  -- \
  upgrade \
  --new_wasm_hash "${PREVIOUS_WASM_HASH}" >/dev/null

echo "==> Rollback completed"
