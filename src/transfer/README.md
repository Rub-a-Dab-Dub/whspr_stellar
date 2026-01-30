# P2P Transfer Module

A comprehensive peer-to-peer token transfer system with zero platform fees, built for the Stellar blockchain.

## Features

✅ **P2P Transfers**: Direct token transfers between users with zero platform fees
✅ **Recipient Validation**: Automatic validation of recipient accounts
✅ **Balance Checking**: Pre-transfer balance validation
✅ **Blockchain Integration**: On-chain Stellar transfers with transaction tracking
✅ **Transfer History**: Complete transfer history with filtering and pagination
✅ **Notifications**: Real-time notifications for both sender and recipient
✅ **Bulk Transfers**: Send to multiple recipients in a single operation
✅ **Memo Support**: Add memos (up to 28 characters) to transfers
✅ **Notes**: Add private notes (up to 500 characters) to transfers
✅ **Transfer Receipts**: Generate detailed receipts for completed transfers
✅ **Analytics**: Track transfer volume, success rates, and trends
✅ **Balance Snapshots**: Record balance before and after each transfer

## API Endpoints

### 1. Create Transfer
**POST** `/transfers`

Create a new P2P transfer.

**Request Body:**
```json
{
  "recipientId": "uuid",
  "amount": 100.50,
  "memo": "Payment for services",
  "note": "Internal note",
  "blockchainNetwork": "stellar"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transfer initiated successfully",
  "data": {
    "id": "uuid",
    "senderId": "uuid",
    "recipientId": "uuid",
    "amount": "100.50000000",
    "status": "pending",
    "type": "p2p",
    "memo": "Payment for services",
    "note": "Internal note",
    "blockchainNetwork": "stellar",
    "createdAt": "2026-01-28T12:00:00Z"
  }
}
```

### 2. Create Bulk Transfer
**POST** `/transfers/bulk`

Send tokens to multiple recipients in a single operation.

**Request Body:**
```json
{
  "recipients": [
    {
      "recipientId": "uuid-1",
      "amount": 50.25,
      "note": "Payment 1"
    },
    {
      "recipientId": "uuid-2",
      "amount": 75.50,
      "note": "Payment 2"
    }
  ],
  "memo": "Bulk payment",
  "blockchainNetwork": "stellar"
}
```

**Validation:**
- Minimum 2 recipients, maximum 100 recipients
- No duplicate recipients
- Cannot include yourself as a recipient
- Total amount must not exceed sender's balance

**Response:**
```json
{
  "success": true,
  "message": "Bulk transfer initiated successfully",
  "data": {
    "id": "uuid",
    "senderId": "uuid",
    "totalRecipients": 2,
    "totalAmount": "125.75000000",
    "status": "pending",
    "successfulTransfers": 0,
    "failedTransfers": 0,
    "createdAt": "2026-01-28T12:00:00Z"
  }
}
```

### 3. Get Transfer History
**GET** `/transfers/history`

Retrieve transfer history with filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by status (pending, processing, completed, failed, cancelled)
- `type` (optional): Filter by type (p2p, bulk)
- `recipientId` (optional): Filter by recipient
- `senderId` (optional): Filter by sender
- `limit` (optional): Number of results (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sender": {
        "id": "uuid",
        "email": "sender@example.com"
      },
      "recipient": {
        "id": "uuid",
        "email": "recipient@example.com"
      },
      "amount": "100.50000000",
      "status": "completed",
      "transactionHash": "abc123...",
      "createdAt": "2026-01-28T12:00:00Z",
      "completedAt": "2026-01-28T12:01:00Z"
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 20,
    "offset": 0
  }
}
```

### 4. Get Transfer Details
**GET** `/transfers/:transferId`

Get detailed information about a specific transfer.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sender": {
      "id": "uuid",
      "email": "sender@example.com"
    },
    "recipient": {
      "id": "uuid",
      "email": "recipient@example.com"
    },
    "amount": "100.50000000",
    "status": "completed",
    "type": "p2p",
    "memo": "Payment for services",
    "note": "Internal note",
    "transactionHash": "abc123...",
    "blockchainNetwork": "stellar",
    "senderBalanceBefore": "500.00000000",
    "senderBalanceAfter": "399.50000000",
    "recipientBalanceBefore": "200.00000000",
    "recipientBalanceAfter": "300.50000000",
    "createdAt": "2026-01-28T12:00:00Z",
    "completedAt": "2026-01-28T12:01:00Z"
  }
}
```

### 5. Get Transfer Receipt
**GET** `/transfers/:transferId/receipt`

Generate a detailed receipt for a completed transfer.

**Response:**
```json
{
  "success": true,
  "data": {
    "transferId": "uuid",
    "transactionHash": "abc123...",
    "sender": {
      "id": "uuid",
      "email": "sender@example.com"
    },
    "recipient": {
      "id": "uuid",
      "email": "recipient@example.com"
    },
    "amount": "100.50000000",
    "memo": "Payment for services",
    "note": "Internal note",
    "status": "completed",
    "blockchainNetwork": "stellar",
    "timestamp": "2026-01-28T12:01:00Z",
    "balanceChanges": {
      "senderBefore": "500.00000000",
      "senderAfter": "399.50000000",
      "recipientBefore": "200.00000000",
      "recipientAfter": "300.50000000"
    }
  }
}
```

### 6. Get Transfer Analytics
**GET** `/transfers/analytics?days=30`

Get analytics for your transfers.

**Query Parameters:**
- `days` (optional): Number of days to analyze (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTransfers": 150,
    "totalVolume": "15000.50000000",
    "successRate": 98.67,
    "averageAmount": "100.00333333",
    "topRecipients": [
      {
        "recipientId": "uuid",
        "count": 25,
        "totalAmount": "2500.00000000"
      }
    ],
    "dailyVolume": [
      {
        "date": "2026-01-28",
        "volume": "500.00000000",
        "count": 5
      }
    ]
  }
}
```

### 7. Get Bulk Transfer Details
**GET** `/transfers/bulk/:bulkTransferId`

Get details about a bulk transfer.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "senderId": "uuid",
    "totalRecipients": 10,
    "totalAmount": "1000.00000000",
    "successfulTransfers": 9,
    "failedTransfers": 1,
    "status": "partially_completed",
    "blockchainNetwork": "stellar",
    "createdAt": "2026-01-28T12:00:00Z",
    "completedAt": "2026-01-28T12:05:00Z"
  }
}
```

### 8. Get Bulk Transfer Items
**GET** `/transfers/bulk/:bulkTransferId/items`

Get all individual transfers in a bulk transfer.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "recipientId": "uuid",
      "amount": "100.00000000",
      "status": "completed",
      "transactionHash": "abc123...",
      "note": "Payment 1"
    }
  ]
}
```

## Validation Rules

### Amount Validation
- Must be greater than 0
- Maximum 8 decimal places
- Minimum: 0.00000001
- Maximum: 1,000,000,000

### Memo Validation
- Maximum 28 characters (Stellar memo limit)
- Optional field

### Note Validation
- Maximum 500 characters
- Optional field
- Private to sender (not on blockchain)

### Recipient Validation
- Must be a valid user ID (UUID)
- Cannot transfer to yourself
- Recipient must exist
- Recipient cannot be banned
- Recipient cannot be suspended

### Balance Validation
- Sender must have sufficient balance
- Balance checked before transfer initiation
- Balance snapshots recorded before and after transfer

## Transfer Status Flow

```
PENDING → PROCESSING → COMPLETED
                    ↓
                  FAILED
```

- **PENDING**: Transfer created, awaiting blockchain execution
- **PROCESSING**: Transfer being executed on blockchain
- **COMPLETED**: Transfer successfully completed on-chain
- **FAILED**: Transfer failed (with failure reason)
- **CANCELLED**: Transfer cancelled by user (future feature)

## Notifications

The system sends notifications for:

1. **Transfer Sent**: Notifies sender when transfer is completed
2. **Transfer Received**: Notifies recipient when they receive tokens
3. **Transfer Failed**: Notifies sender if transfer fails
4. **Bulk Transfer Complete**: Notifies sender when bulk transfer finishes

Notifications are queued using Bull and processed asynchronously.

## Environment Variables

Add these to your `.env` file:

```env
# Stellar Configuration
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

For production:
```env
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
```

## Database Schema

### Transfer Entity
- `id`: UUID primary key
- `senderId`: UUID foreign key to users
- `recipientId`: UUID foreign key to users
- `amount`: Decimal(18,8)
- `blockchainNetwork`: String (default: 'stellar')
- `transactionHash`: String (unique, nullable)
- `status`: Enum (pending, processing, completed, failed, cancelled)
- `type`: Enum (p2p, bulk)
- `memo`: Text (nullable)
- `note`: Text (nullable)
- `bulkTransferId`: UUID (nullable)
- `senderBalanceBefore`: Decimal(18,8)
- `senderBalanceAfter`: Decimal(18,8)
- `recipientBalanceBefore`: Decimal(18,8)
- `recipientBalanceAfter`: Decimal(18,8)
- `failureReason`: Text (nullable)
- `retryCount`: Integer (default: 0)
- `completedAt`: Timestamp (nullable)
- `failedAt`: Timestamp (nullable)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

**Indexes:**
- `(senderId, createdAt)`
- `(recipientId, createdAt)`
- `(status, createdAt)`
- `transactionHash`

### BulkTransfer Entity
- `id`: UUID primary key
- `senderId`: UUID foreign key to users
- `totalRecipients`: Integer
- `totalAmount`: Decimal(18,8)
- `successfulTransfers`: Integer (default: 0)
- `failedTransfers`: Integer (default: 0)
- `status`: Enum (pending, processing, completed, partially_completed, failed)
- `blockchainNetwork`: String (default: 'stellar')
- `memo`: Text (nullable)
- `completedAt`: Timestamp (nullable)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

**Indexes:**
- `(senderId, createdAt)`
- `(status, createdAt)`

## Error Handling

Common error responses:

### Insufficient Balance
```json
{
  "statusCode": 400,
  "message": "Insufficient balance. Available: 50.00, Required: 100.00",
  "error": "Bad Request"
}
```

### Recipient Not Found
```json
{
  "statusCode": 404,
  "message": "Recipient not found",
  "error": "Not Found"
}
```

### Invalid Amount
```json
{
  "statusCode": 400,
  "message": "Amount must be greater than zero",
  "error": "Bad Request"
}
```

### Self Transfer
```json
{
  "statusCode": 400,
  "message": "Cannot transfer to yourself",
  "error": "Bad Request"
}
```

## Testing

Example test scenarios:

1. **Successful P2P Transfer**
   - Create transfer with valid recipient and sufficient balance
   - Verify transfer status changes from pending → processing → completed
   - Verify balance snapshots are recorded
   - Verify notifications are sent

2. **Insufficient Balance**
   - Attempt transfer with amount > balance
   - Verify error is thrown before blockchain execution

3. **Invalid Recipient**
   - Attempt transfer to non-existent user
   - Attempt transfer to banned user
   - Attempt transfer to self

4. **Bulk Transfer**
   - Create bulk transfer with multiple recipients
   - Verify all individual transfers are created
   - Verify bulk transfer status updates correctly

5. **Transfer History**
   - Create multiple transfers
   - Test filtering by status, type, recipient
   - Test pagination

## Future Enhancements

- [ ] Transfer cancellation (for pending transfers)
- [ ] Scheduled transfers
- [ ] Recurring transfers
- [ ] Transfer templates
- [ ] Multi-currency support
- [ ] Transfer limits and daily caps
- [ ] KYC/AML integration
- [ ] Transfer approval workflow
- [ ] PDF receipt generation
- [ ] Email receipts
- [ ] Transfer disputes
- [ ] Refund functionality
