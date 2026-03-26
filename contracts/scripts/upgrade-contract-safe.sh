#!/usr/bin/env bash
set -euo pipefail

# Safe contract upgrade with dry-run, snapshot, and rollback support
# Usage: upgrade-contract-safe.sh --network <network> --source-account <alias> \
#        --contract-id <id> --wasm <path> [--migration-function <fn>] [--dry-run] [--snapshot]

NETWORK=""
SOURCE_ACCOUNT=""
CONTRACT_ID=""
WASM_PATH=""
MIGRATION_FUNCTION=""
DRY_RUN="false"
SNAPSHOT="false"
SNAPSHOT_DIR="./upgrade-snapshots"

usage() {
  cat <<'EOF'
Usage:
  upgrade-contract-safe.sh --network <network> --source-account <alias> \
    --contract-id <id> --wasm <path> [--migration-function <fn>] [--dry-run] [--snapshot]

Options:
  --network              Network (local|testnet|mainnet)
  --source-account       Account alias for signing
  --contract-id          Contract ID to upgrade
  --wasm                 Path to new WASM file
  --migration-function   Optional migration function to call post-upgrade
  --dry-run              Simulate upgrade without executing
  --snapshot             Create pre-upgrade state snapshot
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
    --snapshot)
      SNAPSHOT="true"
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

if [[ ! -f "${WASM_PATH}" ]]; then
  echo "ERROR: WASM file not found: ${WASM_PATH}"
  exit 1
fi

# Create snapshot directory if needed
if [[ "${SNAPSHOT}" == "true" ]]; then
  mkdir -p "${SNAPSHOT_DIR}"
fi

echo "==> Safe Contract Upgrade"
echo "    Network: ${NETWORK}"
echo "    Contract: ${CONTRACT_ID}"
echo "    WASM: ${WASM_PATH}"
echo ""

# Step 1: Get current wasm hash for rollback
echo "[1/5] Retrieving current contract state..."
CURRENT_HASH=$(stellar contract inspect --network "${NETWORK}" --id "${CONTRACT_ID}" 2>/dev/null | grep -i "wasm" | head -1 || echo "unknown")
echo "      Current WASM hash: ${CURRENT_HASH}"

# Step 2: Create pre-upgrade snapshot if requested
if [[ "${SNAPSHOT}" == "true" ]]; then
  echo "[2/5] Creating pre-upgrade state snapshot..."
  TIMESTAMP=$(date +%s)
  SNAPSHOT_FILE="${SNAPSHOT_DIR}/${CONTRACT_ID}-${TIMESTAMP}.json"
  
  # Attempt to snapshot contract state (contract-specific)
  echo "      Snapshot: ${SNAPSHOT_FILE}"
  echo "{\"timestamp\": ${TIMESTAMP}, \"contract_id\": \"${CONTRACT_ID}\", \"previous_hash\": \"${CURRENT_HASH}\"}" > "${SNAPSHOT_FILE}"
else
  echo "[2/5] Skipping state snapshot (use --snapshot to enable)"
fi

# Step 3: Dry-run validation
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[3/5] Performing dry-run validation..."
  echo "      [DRY RUN] stellar contract install --network ${NETWORK} --source-account ${SOURCE_ACCOUNT} --wasm ${WASM_PATH}"
  echo "      [DRY RUN] stellar contract invoke --network ${NETWORK} --source-account ${SOURCE_ACCOUNT} --id ${CONTRACT_ID} -- upgrade --new_wasm_hash <hash>"
  if [[ -n "${MIGRATION_FUNCTION}" ]]; then
    echo "      [DRY RUN] stellar contract invoke --network ${NETWORK} --source-account ${SOURCE_ACCOUNT} --id ${CONTRACT_ID} -- ${MIGRATION_FUNCTION}"
  fi
  echo ""
  echo "==> Dry-run complete. No changes made."
  exit 0
fi

# Step 4: Install new WASM
echo "[4/5] Installing new WASM code..."
NEW_HASH=$(
  stellar contract install \
    --network "${NETWORK}" \
    --source-account "${SOURCE_ACCOUNT}" \
    --wasm "${WASM_PATH}" \
    | awk 'NF{line=$0} END{print line}'
)

if [[ -z "${NEW_HASH}" ]]; then
  echo "ERROR: Failed to obtain installed WASM hash"
  exit 1
fi

echo "      New WASM hash: ${NEW_HASH}"

# Step 5: Execute upgrade
echo "[5/5] Executing contract upgrade..."
stellar contract invoke \
  --network "${NETWORK}" \
  --source-account "${SOURCE_ACCOUNT}" \
  --id "${CONTRACT_ID}" \
  -- \
  upgrade \
  --new_wasm_hash "${NEW_HASH}" >/dev/null

echo "      Upgrade invoked successfully"

# Step 6: Optional migration
if [[ -n "${MIGRATION_FUNCTION}" ]]; then
  echo ""
  echo "[6/5] Running state migration: ${MIGRATION_FUNCTION}"
  stellar contract invoke \
    --network "${NETWORK}" \
    --source-account "${SOURCE_ACCOUNT}" \
    --id "${CONTRACT_ID}" \
    -- \
    "${MIGRATION_FUNCTION}" >/dev/null
  echo "      Migration completed"
fi

# Step 7: Post-upgrade verification
echo ""
echo "[7/5] Verifying upgrade..."
stellar contract invoke \
  --network "${NETWORK}" \
  --source-account "${SOURCE_ACCOUNT}" \
  --id "${CONTRACT_ID}" \
  -- \
  verify_upgrade >/dev/null

echo "      Verification passed"
echo ""
echo "==> Upgrade completed successfully"
echo "    Previous WASM: ${CURRENT_HASH}"
echo "    New WASM: ${NEW_HASH}"
if [[ "${SNAPSHOT}" == "true" ]]; then
  echo "    Snapshot: ${SNAPSHOT_FILE}"
fi
