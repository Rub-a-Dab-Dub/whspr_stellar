#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update versioned contract registry.")
    parser.add_argument("--network", required=True, choices=["local", "testnet", "mainnet"])
    parser.add_argument("--registry", required=True)
    parser.add_argument("--deployments", required=True)
    parser.add_argument("--commit-sha", default="")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    registry_path = Path(args.registry)
    deployments_path = Path(args.deployments)

    if not registry_path.exists():
        raise SystemExit(f"Registry file missing: {registry_path}")
    if not deployments_path.exists():
        raise SystemExit(f"Deployments file missing: {deployments_path}")

    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    deployments = json.loads(deployments_path.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    if "networks" not in registry:
        registry["networks"] = {}
    if args.network not in registry["networks"]:
        registry["networks"][args.network] = {"latest": {}, "history": []}

    network_slot = registry["networks"][args.network]
    network_slot["latest"] = deployments
    network_slot.setdefault("history", [])
    network_slot["history"].append(
        {
            "deployed_at": now,
            "commit_sha": args.commit_sha,
            "contracts": deployments,
        }
    )
    registry["updated_at"] = now
    registry["version"] = int(registry.get("version", 0)) + 1

    registry_path.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf-8")
    print(f"Registry updated: network={args.network}, version={registry['version']}")


if __name__ == "__main__":
    main()
