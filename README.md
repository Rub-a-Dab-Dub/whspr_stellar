# whspr_stellar

**Soroban smart contract for Gasless Gossip** — the on-chain messaging/tipping logic that powers the [Gasless Gossip](https://www.gaslessgossip.com) app on Stellar.

This repo contains only the Rust/Soroban contract. The app's other components live in sibling repos:

- **Backend (NestJS API)** — `whisper-backend`
- **Frontend (Next.js web app)** — `whisper-frontend`

---

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) with the `wasm32-unknown-unknown` target:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-stellar-cli) (for deploying/invoking)

## Project Structure

```
whspr_stellar/
├── Cargo.toml          # Workspace manifest
├── Makefile             # build / test / deploy / invoke targets
└── messaging/           # Soroban messaging contract
    ├── Cargo.toml
    └── src/
        └── lib.rs
```

## Building

```bash
make build
```

## Testing

```bash
make test
# or a specific test:
cargo test test_tip_user
```

## Deploying

Set the required environment variables (see `.env.example`), then:

```bash
make deploy-testnet
# or
make deploy-mainnet
```

## Invoking

```bash
make invoke-testnet FN=<function_name> ARGS="--arg value"
```

## Contract Overview

The `messaging` contract implements the on-chain logic for Gasless Gossip's chat rooms:

- **Rooms**: create token-gated or open chat rooms
- **Messages**: send messages, earning XP
- **Tipping**: tip users in-room with a platform fee
- **XP & Levels**: track user experience and levels on-chain

See [`messaging/src/lib.rs`](messaging/src/lib.rs) for the full implementation.

## Contributing

1. Fork & clone the repo
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Follow existing Rust formatting: `cargo fmt --all`
4. Write/update tests for contract changes
5. Run `make test` before opening a PR
6. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages

## License

MIT License - see [LICENSE](LICENSE) file for details
