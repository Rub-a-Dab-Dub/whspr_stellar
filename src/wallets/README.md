# Wallet Management System

Complete wallet management system with async generation, session keys, and multi-wallet support.

## Features

✅ Async wallet generation via Bull queue
✅ Secure session key creation
✅ Encrypted private key storage
✅ Balance checking
✅ Multi-wallet support per user
✅ Wallet export/backup
✅ Wallet recovery mechanism
✅ Transaction history tracking
✅ Primary wallet management

## API Endpoints

### POST /wallets/generate
Generate new wallet asynchronously
```json
{
  "userId": "optional-user-id"
}
```

### GET /wallets
Get all user wallets

### GET /wallets/:id/balance
Check wallet balance

### POST /wallets/:id/export
Export wallet private key (requires authentication)

### POST /wallets/recover
Recover wallet from private key
```json
{
  "privateKey": "0x..."
}
```

### GET /wallets/:id/transactions
Get wallet transaction history

### POST /wallets/:id/set-primary
Set wallet as primary

## Environment Variables

Add to `.env`:
```
WALLET_ENCRYPTION_KEY=your_64_char_hex_key
```

## Database Migration

Run migration:
```bash
npm run migration:run
```

## Security

- Private keys encrypted with AES-256-CBC
- Session keys for gasless transactions
- Nonce tracking for replay protection
- User-wallet association enforced
