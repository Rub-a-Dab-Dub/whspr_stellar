#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="${ROOT_DIR}/scripts"
OUT_DIR="${ROOT_DIR}/out"
REGISTRY_FILE="${ROOT_DIR}/deployments/registry.json"
NETWORK=""
SOURCE_ACCOUNT=""
SKIP_BUILD="false"
COMMIT_SHA="${GITHUB_SHA:-local-dev}"

usage() {
  cat <<'EOF'
Usage:
  deploy-all.sh --network <network> --source-account <alias> [--registry <file>] [--skip-build]
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
    --skip-build)
      SKIP_BUILD="true"
      shift 1
      ;;
    --commit-sha)
      COMMIT_SHA="$2"
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

if [[ "${SKIP_BUILD}" != "true" ]]; then
  bash "${SCRIPTS_DIR}/build-contracts.sh"
fi

if ! ls "${OUT_DIR}"/*.wasm >/dev/null 2>&1; then
  echo "No wasm artifacts found in ${OUT_DIR}. Run build first."
  exit 1
fi

deployments_tmp="$(mktemp)"
printf '{}' >"${deployments_tmp}"

echo "==> Deploying contracts to ${NETWORK}"
for wasm in "${OUT_DIR}"/*.wasm; do
  contract_name="$(basename "${wasm}" .wasm)"
  echo "  -> Deploying ${contract_name}"
  contract_id="$(
    bash "${SCRIPTS_DIR}/deploy-contract.sh" \
      --network "${NETWORK}" \
      --source-account "${SOURCE_ACCOUNT}" \
      --wasm "${wasm}"
  )"
  python - "${deployments_tmp}" "${contract_name}" "${contract_id}" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
name = sys.argv[2]
contract_id = sys.argv[3]
data = json.loads(path.read_text(encoding="utf-8"))
data[name] = contract_id
path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PY
done

python "${SCRIPTS_DIR}/update-registry.py" \
  --network "${NETWORK}" \
  --registry "${REGISTRY_FILE}" \
  --deployments "${deployments_tmp}" \
  --commit-sha "${COMMIT_SHA}"

echo "==> Deployment complete. Contract ids:"
cat "${deployments_tmp}"

rm -f "${deployments_tmp}"
