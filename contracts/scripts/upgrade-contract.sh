#!/usr/bin/env bash
set -euo pipefail

NETWORK=""
SOURCE_ACCOUNT=""
CONTRACT_ID=""
WASM_PATH=""
MIGRATION_FUNCTION=""
DRY_RUN="false"

usage() {
  cat <<'EOF'
Usage:
  upgrade-contract.sh --network <network> --source-account <alias> --contract-id <id> --wasm <path> [--migration-function <fn>] [--dry-run]
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
    --wasm)
      WASM_PATH="$2"
      shift 2
      ;;
    --migration-function)
      MIGRATION_FUNCTION="$2"
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

if [[ -z "${NETWORK}" || -z "${SOURCE_ACCOUNT}" || -z "${CONTRACT_ID}" || -z "${WASM_PATH}" ]]; then
  usage
  exit 1
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[DRY RUN] stellar contract install --network ${NETWORK} --source-account ${SOURCE_ACCOUNT} --wasm ${WASM_PATH}"
  echo "[DRY RUN] stellar contract invoke --network ${NETWORK} --source-account ${SOURCE_ACCOUNT} --id ${CONTRACT_ID} -- upgrade --new_wasm_hash <installed_hash>"
  if [[ -n "${MIGRATION_FUNCTION}" ]]; then
    echo "[DRY RUN] stellar contract invoke --network ${NETWORK} --source-account ${SOURCE_ACCOUNT} --id ${CONTRACT_ID} -- ${MIGRATION_FUNCTION}"
  fi
  exit 0
fi

if [[ ! -f "${WASM_PATH}" ]]; then
  echo "WASM file not found: ${WASM_PATH}"
  exit 1
fi

echo "==> Installing upgraded wasm"
wasm_hash="$(
  stellar contract install \
    --network "${NETWORK}" \
    --source-account "${SOURCE_ACCOUNT}" \
    --wasm "${WASM_PATH}" \
    | awk 'NF{line=$0} END{print line}'
)"

if [[ -z "${wasm_hash}" ]]; then
  echo "Failed to obtain installed wasm hash."
  exit 1
fi

echo "==> Upgrading contract ${CONTRACT_ID}"
stellar contract invoke \
  --network "${NETWORK}" \
  --source-account "${SOURCE_ACCOUNT}" \
  --id "${CONTRACT_ID}" \
  -- \
  upgrade \
  --new_wasm_hash "${wasm_hash}" >/dev/null

if [[ -n "${MIGRATION_FUNCTION}" ]]; then
  echo "==> Running state migration function: ${MIGRATION_FUNCTION}"
  stellar contract invoke \
    --network "${NETWORK}" \
    --source-account "${SOURCE_ACCOUNT}" \
    --id "${CONTRACT_ID}" \
    -- \
    "${MIGRATION_FUNCTION}" >/dev/null
fi

echo "==> Upgrade completed"
echo "wasm_hash=${wasm_hash}"
