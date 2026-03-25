#!/usr/bin/env bash
set -euo pipefail

FRIENDBOT_URL="${FRIENDBOT_URL:-https://friendbot.stellar.org}"
ADDRESS=""
ACCOUNT_ALIAS=""

usage() {
  cat <<'EOF'
Usage:
  fund-testnet-account.sh --address <g...>
  fund-testnet-account.sh --account-alias <alias>
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --address)
      ADDRESS="$2"
      shift 2
      ;;
    --account-alias)
      ACCOUNT_ALIAS="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -n "${ACCOUNT_ALIAS}" ]]; then
  ADDRESS="$(stellar keys address "${ACCOUNT_ALIAS}")"
fi

if [[ -z "${ADDRESS}" ]]; then
  usage
  exit 1
fi

echo "==> Funding account ${ADDRESS} via friendbot"
curl --fail --silent --show-error "${FRIENDBOT_URL}?addr=${ADDRESS}" >/dev/null
echo "==> Account funded"
