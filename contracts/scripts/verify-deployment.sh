#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY_FILE="${ROOT_DIR}/deployments/registry.json"
NETWORK=""
SOURCE_ACCOUNT=""

usage() {
  cat <<'EOF'
Usage:
  verify-deployment.sh --network <network> --source-account <alias> [--registry <file>]
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
    --registry)
      REGISTRY_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${NETWORK}" || -z "${SOURCE_ACCOUNT}" ]]; then
  usage
  exit 1
fi

if [[ ! -f "${REGISTRY_FILE}" ]]; then
  echo "Registry file not found: ${REGISTRY_FILE}"
  exit 1
fi

HELLO_WORLD_ID="$(python - "${REGISTRY_FILE}" "${NETWORK}" <<'PY'
import json
import sys

registry_path, network = sys.argv[1], sys.argv[2]
with open(registry_path, "r", encoding="utf-8") as f:
    data = json.load(f)
print(data["networks"].get(network, {}).get("latest", {}).get("hello_world", ""))
PY
)"

WHSPR_TOKEN_ID="$(python - "${REGISTRY_FILE}" "${NETWORK}" <<'PY'
import json
import sys

registry_path, network = sys.argv[1], sys.argv[2]
with open(registry_path, "r", encoding="utf-8") as f:
    data = json.load(f)
print(data["networks"].get(network, {}).get("latest", {}).get("whspr_token", ""))
PY
)"

if [[ -z "${HELLO_WORLD_ID}" || -z "${WHSPR_TOKEN_ID}" ]]; then
  echo "Latest contract ids not found in registry for network: ${NETWORK}"
  exit 1
fi

echo "==> Running post-deploy health checks"
echo "  -> hello_world.hello(to: CI)"
stellar contract invoke \
  --network "${NETWORK}" \
  --source-account "${SOURCE_ACCOUNT}" \
  --id "${HELLO_WORLD_ID}" \
  -- \
  hello \
  --to CI >/dev/null

account_address="$(stellar keys address "${SOURCE_ACCOUNT}")"

echo "  -> whspr_token.initialize(admin/source account)"
set +e
initialize_output="$(
  stellar contract invoke \
    --network "${NETWORK}" \
    --source-account "${SOURCE_ACCOUNT}" \
    --id "${WHSPR_TOKEN_ID}" \
    -- \
    initialize \
    --admin "${account_address}" \
    --decimal 7 \
    --name "Whspr Token" \
    --symbol "WHSPR" 2>&1
)"
initialize_exit=$?
set -e

if [[ ${initialize_exit} -ne 0 ]]; then
  if [[ "${initialize_output}" != *"already initialized"* ]]; then
    echo "Token initialize check failed:"
    echo "${initialize_output}"
    exit 1
  fi
fi

echo "  -> whspr_token.mint(to: source account)"
stellar contract invoke \
  --network "${NETWORK}" \
  --source-account "${SOURCE_ACCOUNT}" \
  --id "${WHSPR_TOKEN_ID}" \
  -- \
  mint \
  --to "${account_address}" \
  --amount 1 >/dev/null

echo "  -> whspr_token.balance(addr: ${account_address})"
stellar contract invoke \
  --network "${NETWORK}" \
  --source-account "${SOURCE_ACCOUNT}" \
  --id "${WHSPR_TOKEN_ID}" \
  -- \
  balance \
  --addr "${account_address}" >/dev/null

echo "  -> whspr_token.transfer(from: source, to: source, amount: 0)"
stellar contract invoke \
  --network "${NETWORK}" \
  --source-account "${SOURCE_ACCOUNT}" \
  --id "${WHSPR_TOKEN_ID}" \
  -- \
  transfer \
  --from "${account_address}" \
  --to "${account_address}" \
  --amount 0 >/dev/null

echo "==> Health checks passed"
