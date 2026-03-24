# Whspr Stellar - Soroban Smart Contracts

Soroban smart contract workspace for the Whspr Stellar project. Contains multi-contract support, local testnet configuration, and end-to-end build/test/deploy tooling.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Rust** | 1.84.0+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Stellar CLI** | 25.x | `cargo install --locked stellar-cli` |
| **Docker** | 20.x+ | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Make** | any | Pre-installed on macOS/Linux. Windows: install via `choco install make` |

## Quick Start

```bash
# 1. Enter the contracts workspace
cd contracts

# 2. Install Rust target and Stellar CLI
make setup

# 3. Start the local Stellar testnet (Docker)
make local-net

# 4. Configure CLI network aliases and generate a test key
make network-setup

# 5. Build all contracts
make build

# 6. Run tests
make test

# 7. Deploy to local testnet
make deploy ENV=local
```

## Project Structure

```
contracts/
├── Cargo.toml                  # Workspace root (dependency versions here)
├── Makefile                    # Build, test, deploy, ABI targets
├── rust-toolchain.toml         # Pins Rust 1.84.0 + wasm target
├── .env.local                  # Local testnet environment
├── .env.testnet                # Stellar public testnet environment
├── .env.mainnet                # Stellar mainnet environment
├── README.md                   # This file
├── contracts/
│   ├── hello_world/            # Example "Hello World" contract
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── test.rs
│   └── token/                  # Whspr token contract (SEP-41 compatible)
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           └── test.rs
└── out/                        # Build artifacts (git-ignored)
    ├── hello-world.wasm
    ├── whspr-token.wasm
    ├── abi/                    # Exported contract ABIs
    └── bindings/               # Generated TypeScript bindings
```

## Adding a New Contract

1. Create a directory under `contracts/contracts/`:

```bash
mkdir -p contracts/my_contract/src
```

2. Add a `Cargo.toml` for the new contract:

```toml
[package]
name = "my-contract"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
crate-type = ["cdylib"]
doctest = false

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
```

3. Add `src/lib.rs` with your contract logic. The workspace `Cargo.toml` glob pattern (`contracts/*`) picks up new contracts automatically.

## Make Targets

| Command | Description |
|---------|-------------|
| `make setup` | Install wasm target and Stellar CLI |
| `make build` | Build all contracts to `out/*.wasm` |
| `make build-optimized` | Build and optimize WASM binaries |
| `make test` | Run all contract unit tests |
| `make fmt` | Format all Rust source files |
| `make check` | Lint with clippy + format check |
| `make abi` | Export ABIs and generate TypeScript bindings |
| `make deploy ENV=local` | Deploy all contracts to the selected network |
| `make deploy-one CONTRACT=hello-world ENV=local` | Deploy a single contract |
| `make local-net` | Start Stellar Quickstart Docker testnet |
| `make local-net-stop` | Stop the local testnet container |
| `make network-setup` | Register network aliases in Stellar CLI |
| `make clean` | Remove `target/` and `out/` |

## Local Testnet

The local testnet uses the official [stellar/quickstart](https://hub.docker.com/r/stellar/quickstart) Docker image, which bundles Stellar Core, Soroban RPC, Horizon, and Friendbot.

**Start via Make:**

```bash
make local-net
```

**Or via Docker Compose** (from the repo root):

```bash
docker-compose up stellar-local
```

Once running:

| Service | URL |
|---------|-----|
| Soroban RPC | http://localhost:8000/soroban/rpc |
| Horizon API | http://localhost:8000 |
| Friendbot (fund accounts) | http://localhost:8000/friendbot?addr=YOUR_ADDRESS |

### Fund a Test Account

```bash
curl "http://localhost:8000/friendbot?addr=$(stellar keys address default)"
```

## Environment Configuration

Three `.env` files are provided for different networks:

| File | Network | RPC URL |
|------|---------|---------|
| `.env.local` | Standalone Docker | `http://localhost:8000/soroban/rpc` |
| `.env.testnet` | Stellar Testnet | `https://soroban-testnet.stellar.org` |
| `.env.mainnet` | Stellar Mainnet | `https://soroban-rpc.mainnet.stellar.gateway.fm` |

Switch networks by passing `ENV=` to make targets:

```bash
make deploy ENV=testnet
make deploy ENV=mainnet
```

## ABI Export and TypeScript Bindings

After building, generate contract ABIs and TypeScript client bindings:

```bash
make abi
```

This writes:
- `out/abi/<contract-name>.json` -- contract specification / ABI
- `out/bindings/<contract-name>/` -- TypeScript client package (importable in frontend code)

## Deploying to Testnet

```bash
# Generate and fund a testnet identity
stellar keys generate deployer --network testnet --fund

# Deploy with testnet env
make deploy ENV=testnet
```

## Troubleshooting

**`cargo build` fails with target errors:**
```bash
rustup target add wasm32-unknown-unknown
```

**Local testnet unreachable:**
```bash
docker ps                  # verify stellar_local container is running
docker logs stellar_local  # check for startup errors
```

**"account not found" on deploy:**
```bash
# Fund the default identity via friendbot
curl "http://localhost:8000/friendbot?addr=$(stellar keys address default)"
```

**Stellar CLI not found:**
```bash
cargo install --locked stellar-cli
```
