CONTRACTS_DIR := contracts
TARGET_DIR := target/wasm32-unknown-unknown/release
OUT_DIR := out

# Default network env (override with: make deploy ENV=testnet)
ENV ?= local

# Load environment variables from the selected .env file
ifneq (,$(wildcard .env.$(ENV)))
  include .env.$(ENV)
  export
endif

CONTRACTS := $(notdir $(wildcard $(CONTRACTS_DIR)/*))
WASM_FILES := $(foreach c,$(CONTRACTS),$(OUT_DIR)/$(subst _,-,$(c)).wasm)

.PHONY: all build test clean deploy fmt check setup abi

all: build

# ──────────────────────────────────────────────
# Setup
# ──────────────────────────────────────────────

setup:
	@echo "==> Installing Rust wasm32-unknown-unknown target..."
	rustup target add wasm32-unknown-unknown
	@echo "==> Installing Stellar CLI..."
	cargo install --locked stellar-cli
	@echo "==> Setup complete. Run 'make build' to compile contracts."

# ──────────────────────────────────────────────
# Build
# ──────────────────────────────────────────────

build:
	@echo "==> Building all contracts..."
	cargo build --target wasm32-unknown-unknown --release
	@mkdir -p $(OUT_DIR)
	@for contract in $(CONTRACTS); do \
		wasm=$$(echo $$contract | tr '_' '-'); \
		if [ -f "$(TARGET_DIR)/$$wasm.wasm" ]; then \
			cp "$(TARGET_DIR)/$$wasm.wasm" "$(OUT_DIR)/$$wasm.wasm"; \
			echo "  -> $(OUT_DIR)/$$wasm.wasm"; \
		fi; \
	done
	@echo "==> Build complete. WASM files in $(OUT_DIR)/"

build-optimized: build
	@echo "==> Optimizing WASM binaries with stellar contract optimize..."
	@for f in $(OUT_DIR)/*.wasm; do \
		stellar contract optimize --wasm "$$f"; \
		echo "  -> optimized $$f"; \
	done

# ──────────────────────────────────────────────
# Test
# ──────────────────────────────────────────────

test:
	@echo "==> Running all contract tests..."
	cargo test

test-coverage:
	@echo "==> Running tests with coverage..."
	cargo tarpaulin --target-dir target-tarpaulin

# ──────────────────────────────────────────────
# Code quality
# ──────────────────────────────────────────────

fmt:
	cargo fmt --all

check:
	cargo fmt --all -- --check
	cargo clippy --all-targets -- -D warnings

# ──────────────────────────────────────────────
# ABI / Type generation
# ──────────────────────────────────────────────

abi: build
	@echo "==> Exporting contract ABIs and generating TypeScript bindings..."
	@mkdir -p $(OUT_DIR)/abi
	@for f in $(OUT_DIR)/*.wasm; do \
		name=$$(basename "$$f" .wasm); \
		stellar contract inspect --wasm "$$f" > "$(OUT_DIR)/abi/$$name.json" 2>/dev/null || true; \
		stellar contract bindings typescript \
			--wasm "$$f" \
			--output-dir "$(OUT_DIR)/bindings/$$name" \
			--overwrite 2>/dev/null || echo "  (skipped TS bindings for $$name)"; \
		echo "  -> $(OUT_DIR)/abi/$$name.json"; \
	done

# ──────────────────────────────────────────────
# Deploy
# ──────────────────────────────────────────────

deploy: build
	@echo "==> Deploying contracts to $(SOROBAN_NETWORK)..."
	@if [ -z "$(SOROBAN_RPC_URL)" ]; then \
		echo "ERROR: SOROBAN_RPC_URL not set. Run: make deploy ENV=local|testnet|mainnet"; \
		exit 1; \
	fi
	@for f in $(OUT_DIR)/*.wasm; do \
		name=$$(basename "$$f" .wasm); \
		echo "  -> Deploying $$name..."; \
		stellar contract deploy \
			--wasm "$$f" \
			--network $(SOROBAN_NETWORK) \
			--source-account default \
			2>&1 | tee "$(OUT_DIR)/$$name-deploy.log"; \
		echo ""; \
	done

# Deploy a single contract: make deploy-one CONTRACT=hello-world
deploy-one: build
	@echo "==> Deploying $(CONTRACT) to $(SOROBAN_NETWORK)..."
	stellar contract deploy \
		--wasm "$(OUT_DIR)/$(CONTRACT).wasm" \
		--network $(SOROBAN_NETWORK) \
		--source-account default

# ──────────────────────────────────────────────
# Docker / Local Testnet
# ──────────────────────────────────────────────

local-net:
	@echo "==> Starting Stellar Quickstart local testnet..."
	docker run --rm -d \
		--name stellar-local \
		-p 8000:8000 \
		stellar/quickstart:latest \
		--local
	@echo "==> Waiting for local testnet to be ready..."
	@sleep 5
	@echo "==> Local testnet running at http://localhost:8000"
	@echo "    RPC:      http://localhost:8000/soroban/rpc"
	@echo "    Horizon:  http://localhost:8000"
	@echo "    Friendbot: http://localhost:8000/friendbot"

local-net-stop:
	@echo "==> Stopping Stellar local testnet..."
	docker stop stellar-local || true

# Configure CLI network aliases
network-setup:
	stellar network add local \
		--rpc-url http://localhost:8000/soroban/rpc \
		--network-passphrase "Standalone Network ; February 2017"
	stellar network add testnet \
		--rpc-url https://soroban-testnet.stellar.org \
		--network-passphrase "Test SDF Network ; September 2015"
	stellar keys generate default --network local --fund

# ──────────────────────────────────────────────
# Clean
# ──────────────────────────────────────────────

clean:
	cargo clean
	rm -rf $(OUT_DIR)

# ──────────────────────────────────────────────
# Help
# ──────────────────────────────────────────────

help:
	@echo "Soroban Contract Workspace"
	@echo ""
	@echo "Usage: make <target> [ENV=local|testnet|mainnet]"
	@echo ""
	@echo "  setup           Install Rust target and Stellar CLI"
	@echo "  build           Build all contracts to WASM"
	@echo "  build-optimized Build and optimize WASM binaries"
	@echo "  test            Run all contract tests"
	@echo "  fmt             Format all Rust code"
	@echo "  check           Run formatter check and clippy"
	@echo "  abi             Export ABIs and generate TS bindings"
	@echo "  deploy          Deploy all contracts (set ENV=)"
	@echo "  deploy-one      Deploy single contract (CONTRACT=name)"
	@echo "  local-net       Start Stellar Quickstart local testnet"
	@echo "  local-net-stop  Stop the local testnet"
	@echo "  network-setup   Configure CLI network aliases + keys"
	@echo "  clean           Remove build artifacts"
	@echo "  help            Show this help"
