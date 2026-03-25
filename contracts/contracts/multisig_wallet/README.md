# Multisig Wallet Contract

A secure multi-signature wallet implementation for Soroban that enables group treasuries and high-value operations requiring multiple approvals.

## Features

- **Multi-signature transactions**: Require M-of-N signatures before execution
- **Flexible signer management**: Add/remove signers with quorum approval
- **Dynamic threshold updates**: Adjust signature requirements with existing quorum
- **Transaction expiry**: Automatic expiration after configurable TTL (200 ledgers default)
- **Signature revocation**: Signers can revoke their approval before execution
- **Full audit trail**: All operations emit events for transparency
- **Concurrent transactions**: Support multiple pending transactions simultaneously

## Core Structures

### MultisigWallet

```rust
pub struct MultisigWallet {
    pub wallet_id: BytesN<32>,
    pub signers: Vec<Address>,
    pub threshold: u32,
    pub next_tx_nonce: u64,
}
```

### PendingTx

```rust
pub struct PendingTx {
    pub tx_id: BytesN<32>,
    pub wallet_id: BytesN<32>,
    pub to: Address,
    pub amount: i128,
    pub data: Bytes,
    pub created_ledger: u32,
    pub expires_ledger: u32,
    pub signature_count: u32,
    pub executed: bool,
}
```

### SignatureRecord

```rust
pub struct SignatureRecord {
    pub tx_id: BytesN<32>,
    pub signer: Address,
    pub signed_ledger: u32,
}
```

## Main Functions

### Wallet Management

#### `create_wallet(signers: Vec<Address>, threshold: u32) -> BytesN<32>`

Creates a new multisig wallet with specified signers and threshold.

**Parameters:**

- `signers`: List of authorized signer addresses (no duplicates)
- `threshold`: Minimum signatures required (1 ≤ threshold ≤ signers.len())

**Returns:** Unique wallet ID

**Errors:**

- `InvalidSigners`: Empty signer list
- `InvalidThreshold`: Threshold is 0 or exceeds signer count
- `DuplicateSigner`: Duplicate addresses in signer list

### Transaction Management

#### `propose_transaction(wallet_id, to, amount, data, proposer) -> BytesN<32>`

Proposes a new transaction for the wallet.

**Parameters:**

- `wallet_id`: Target wallet ID
- `to`: Recipient address
- `amount`: Transfer amount (can be 0 for data-only transactions)
- `data`: Additional transaction data
- `proposer`: Address proposing the transaction (must be a signer)

**Returns:** Unique transaction ID

**Errors:**

- `WalletNotFound`: Invalid wallet ID
- `NotASigner`: Proposer is not an authorized signer
- `InvalidAmount`: Negative amount

#### `sign_transaction(tx_id, signer)`

Signs a pending transaction.

**Parameters:**

- `tx_id`: Transaction ID to sign
- `signer`: Signer address (must be authorized)

**Errors:**

- `TxNotFound`: Invalid transaction ID
- `NotASigner`: Signer not authorized for this wallet
- `AlreadySigned`: Signer has already signed this transaction
- `TxExpired`: Transaction has expired
- `TxAlreadyExecuted`: Transaction already executed

#### `revoke_signature(tx_id, signer)`

Revokes a previously given signature.

**Parameters:**

- `tx_id`: Transaction ID
- `signer`: Signer address

**Errors:**

- `NotSigned`: Signer hasn't signed this transaction
- `TxExpired`: Transaction has expired
- `TxAlreadyExecuted`: Transaction already executed

#### `execute_transaction(tx_id, executor)`

Executes a transaction once threshold is met.

**Parameters:**

- `tx_id`: Transaction ID to execute
- `executor`: Address executing the transaction (must be a signer)

**Errors:**

- `ThresholdNotMet`: Insufficient signatures
- `TxExpired`: Transaction has expired
- `TxAlreadyExecuted`: Transaction already executed
- `NotASigner`: Executor not authorized

### Signer Management

#### `add_signer(wallet_id, new_signer, approvers)`

Adds a new signer to the wallet (requires quorum).

**Parameters:**

- `wallet_id`: Target wallet ID
- `new_signer`: Address to add as signer
- `approvers`: List of existing signers approving this change (must meet threshold)

**Errors:**

- `ThresholdNotMet`: Insufficient approvals
- `DuplicateSigner`: Address is already a signer

#### `remove_signer(wallet_id, signer_to_remove, approvers)`

Removes a signer from the wallet (requires quorum).

**Parameters:**

- `wallet_id`: Target wallet ID
- `signer_to_remove`: Address to remove
- `approvers`: List of existing signers approving this change

**Errors:**

- `ThresholdNotMet`: Insufficient approvals
- `InvalidThreshold`: Removal would make threshold impossible to meet
- `NotASigner`: Address is not a signer

#### `update_threshold(wallet_id, new_threshold, approvers)`

Updates the signature threshold (requires quorum).

**Parameters:**

- `wallet_id`: Target wallet ID
- `new_threshold`: New threshold value
- `approvers`: List of existing signers approving this change

**Errors:**

- `ThresholdNotMet`: Insufficient approvals
- `InvalidThreshold`: Invalid threshold value

### View Functions

- `get_wallet(wallet_id) -> MultisigWallet`: Retrieve wallet details
- `get_pending_tx(tx_id) -> PendingTx`: Retrieve transaction details
- `has_signed(tx_id, signer) -> bool`: Check if signer has signed
- `get_signature(tx_id, signer) -> SignatureRecord`: Get signature details

## Events

All operations emit events for audit trail:

- `wallet_created`: Wallet creation with signers and threshold
- `tx_proposed`: Transaction proposal with details
- `tx_signed`: Signature added with current count
- `sig_revoked`: Signature revoked with updated count
- `tx_executed`: Transaction execution confirmation
- `signer_added`: New signer added to wallet
- `signer_removed`: Signer removed from wallet
- `threshold_updated`: Threshold changed

## Usage Example

```rust
// Create a 2-of-3 multisig wallet
let mut signers = Vec::new(&env);
signers.push_back(alice);
signers.push_back(bob);
signers.push_back(charlie);

let wallet_id = client.create_wallet(&signers, &2);

// Propose a transaction
let data = Bytes::new(&env);
let tx_id = client.propose_transaction(
    &wallet_id,
    &recipient,
    &1000,
    &data,
    &alice
);

// Collect signatures
client.sign_transaction(&tx_id, &alice);
client.sign_transaction(&tx_id, &bob);

// Execute once threshold is met
client.execute_transaction(&tx_id, &alice);
```

## Security Features

1. **Threshold enforcement**: Transactions cannot execute without required signatures
2. **Signer verification**: All operations verify caller authorization
3. **Duplicate prevention**: Cannot sign twice or add duplicate signers
4. **Expiry mechanism**: Transactions auto-expire after TTL
5. **Quorum requirements**: Signer management requires existing quorum approval
6. **Audit trail**: Complete event history for all operations

## Testing

Run unit tests:

```bash
cd contracts/contracts/multisig_wallet
cargo test
```

Run integration tests:

```bash
cargo test --test integration
```

## Configuration

- `DEFAULT_TX_TTL_LEDGERS`: 200 ledgers (~16 minutes at 5s/ledger)

## Upgrade Support

The contract includes upgrade and migration functions compatible with the gasless-common framework:

- `init(admin)`: Initialize contract with admin
- `upgrade(new_wasm_hash)`: Upgrade contract code
- `migrate_state(from_version, to_version)`: Migrate state between versions
- `verify_upgrade()`: Verify upgrade success

## Access Control

Includes role-based access control via gasless-common:

- `grant_role(role, address, caller)`
- `revoke_role(role, address, caller)`
- `has_role(role, address)`
