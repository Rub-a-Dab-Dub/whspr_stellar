SHELL := /bin/bash
TARGET := wasm32-unknown-unknown

.PHONY: build test clean deploy-testnet deploy-mainnet fmt

build:
	cargo build --release --target $(TARGET)

test:
	cargo test

fmt:
	cargo fmt --all

clean:
	cargo clean

# Requires stellar CLI: https://developers.stellar.org/docs/tools/developer-tools/cli/install-stellar-cli
deploy-testnet:
	stellar contract deploy \
		--wasm target/$(TARGET)/release/messaging.wasm \
		--source $(STELLAR_ACCOUNT) \
		--network testnet

deploy-mainnet:
	stellar contract deploy \
		--wasm target/$(TARGET)/release/messaging.wasm \
		--source $(STELLAR_ACCOUNT) \
		--network mainnet

invoke-testnet:
	stellar contract invoke \
		--id $(CONTRACT_ID) \
		--source $(STELLAR_ACCOUNT) \
		--network testnet \
		-- $(FN) $(ARGS)
