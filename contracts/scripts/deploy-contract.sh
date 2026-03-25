#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  deploy-contract.sh --network <network> --source-account <alias> --wasm <path>
EOF
}

NETWORK=""
SOURCE_ACCOUNT=""
WASM_PATH=""

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
    --wasm)
      WASM_PATH="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${NETWORK}" || -z "${SOURCE_ACCOUNT}" || -z "${WASM_PATH}" ]]; then
  usage
  exit 1
fi

if [[ ! -f "${WASM_PATH}" ]]; then
  echo "WASM file not found: ${WASM_PATH}"
  exit 1
fi

deploy_output="$(
  stellar contract deploy \
    --network "${NETWORK}" \
    --source-account "${SOURCE_ACCOUNT}" \
    --wasm "${WASM_PATH}"
)"

contract_id="$(printf '%s\n' "${deploy_output}" | awk 'NF{line=$0} END{print line}')"
if [[ -z "${contract_id}" ]]; then
  echo "Unable to parse contract id from deployment output."
  echo "${deploy_output}"
  exit 1
fi

echo "${contract_id}"
