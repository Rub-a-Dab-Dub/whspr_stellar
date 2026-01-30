# Transfer Module - Quick Start Guide

## Prerequisites

1. PostgreSQL database running
2. Redis running (for Bull queues)
3. Node.js and npm installed
4. Environment variables configured

## Setup Steps

### 1. Install Dependencies
```bash
npm install @stellar/stellar-sdk --legacy-peer-deps
```

### 2. Configure Environment
Create/update `.env` file:
```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=whspr_stellar

# Stellar
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Redis (for queues)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Run Database Migration
```bash
npm run migration:run
```

### 4. Start the Application
```bash
npm run start:dev
```

## Testing the API

### Step 1: Register and Login

#### Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sender@example.com",
    "password": "SecurePass123!"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sender@example.com",
    "password": "SecurePass123!"
  }'
```

Save the `accessToken` from the response.

### Step 2: Create a Recipient User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "recipient@example.com",
    "password": "SecurePass123!"
  }'
```

Note the `userId` from the response.

### Step 3: Create a Transfer

```bash
curl -X POST http://localhost:3000/transfers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "RECIPIENT_USER_ID",
    "amount": 100.50,
    "memo": "Test payment",
    "note": "My first transfer"
  }'
```

### Step 4: Check Transfer History

```bash
curl -X GET http://localhost:3000/transfers/history \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Step 5: Get Transfer Details

```bash
curl -X GET http://localhost:3000/transfers/TRANSFER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Step 6: Get Transfer Receipt

```bash
curl -X GET http://localhost:3000/transfers/TRANSFER_ID/receipt \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Step 7: View Analytics

```bash
curl -X GET "http://localhost:3000/transfers/analytics?days=30" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Testing Bulk Transfers

### Create Bulk Transfer

```bash
curl -X POST http://localhost:3000/transfers/bulk \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      {
        "recipientId": "RECIPIENT_1_ID",
        "amount": 50.25,
        "note": "Payment 1"
      },
      {
        "recipientId": "RECIPIENT_2_ID",
        "amount": 75.50,
        "note": "Payment 2"
      }
    ],
    "memo": "Bulk payment test"
  }'
```

### Get Bulk Transfer Details

```bash
curl -X GET http://localhost:3000/transfers/bulk/BULK_TRANSFER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Bulk Transfer Items

```bash
curl -X GET http://localhost:3000/transfers/bulk/BULK_TRANSFER_ID/items \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Testing Filters

### Filter by Status
```bash
curl -X GET "http://localhost:3000/transfers/history?status=completed" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Filter by Type
```bash
curl -X GET "http://localhost:3000/transfers/history?type=p2p" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Filter by Recipient
```bash
curl -X GET "http://localhost:3000/transfers/history?recipientId=RECIPIENT_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Pagination
```bash
curl -X GET "http://localhost:3000/transfers/history?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Common Test Scenarios

### 1. Successful Transfer
- Create transfer with valid recipient and amount
- Check status changes from pending → processing → completed
- Verify notifications are sent
- Check balance snapshots

### 2. Insufficient Balance
```bash
curl -X POST http://localhost:3000/transfers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "RECIPIENT_ID",
    "amount": 999999999,
    "memo": "Too much"
  }'
```
Expected: 400 Bad Request - Insufficient balance

### 3. Invalid Recipient
```bash
curl -X POST http://localhost:3000/transfers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "00000000-0000-0000-0000-000000000000",
    "amount": 10
  }'
```
Expected: 404 Not Found - Recipient not found

### 4. Self Transfer
```bash
curl -X POST http://localhost:3000/transfers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "YOUR_OWN_USER_ID",
    "amount": 10
  }'
```
Expected: 400 Bad Request - Cannot transfer to yourself

### 5. Invalid Amount
```bash
curl -X POST http://localhost:3000/transfers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "RECIPIENT_ID",
    "amount": -10
  }'
```
Expected: 400 Bad Request - Amount must be greater than zero

### 6. Too Many Decimal Places
```bash
curl -X POST http://localhost:3000/transfers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "RECIPIENT_ID",
    "amount": 10.123456789
  }'
```
Expected: 400 Bad Request - Amount cannot have more than 8 decimal places

## Postman Collection

You can import this into Postman for easier testing:

```json
{
  "info": {
    "name": "Transfer API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Transfer",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{accessToken}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"recipientId\": \"{{recipientId}}\",\n  \"amount\": 100.50,\n  \"memo\": \"Test payment\",\n  \"note\": \"My first transfer\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": {
          "raw": "{{baseUrl}}/transfers",
          "host": ["{{baseUrl}}"],
          "path": ["transfers"]
        }
      }
    },
    {
      "name": "Get Transfer History",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{accessToken}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/transfers/history?limit=20&offset=0",
          "host": ["{{baseUrl}}"],
          "path": ["transfers", "history"],
          "query": [
            {
              "key": "limit",
              "value": "20"
            },
            {
              "key": "offset",
              "value": "0"
            }
          ]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "accessToken",
      "value": ""
    },
    {
      "key": "recipientId",
      "value": ""
    }
  ]
}
```

## Monitoring

### Check Queue Status
Monitor Bull queues in Redis:
```bash
redis-cli
> KEYS bull:notifications:*
> LLEN bull:notifications:waiting
```

### Check Database
```sql
-- View all transfers
SELECT * FROM transfers ORDER BY created_at DESC LIMIT 10;

-- View transfer statistics
SELECT 
  status,
  COUNT(*) as count,
  SUM(CAST(amount AS DECIMAL)) as total_amount
FROM transfers
GROUP BY status;

-- View bulk transfers
SELECT * FROM bulk_transfers ORDER BY created_at DESC LIMIT 10;
```

### Check Logs
```bash
tail -f logs/combined-*.log
tail -f logs/error-*.log
```

## Troubleshooting

### Transfer Stuck in Pending
- Check if blockchain service is running
- Check Stellar Horizon URL is accessible
- Check wallet addresses are configured
- Check logs for errors

### Notifications Not Sent
- Verify Redis is running
- Check Bull queue configuration
- Check notification processor is running
- Check queue logs

### Balance Not Updating
- Verify Stellar Horizon connection
- Check wallet address configuration
- Check balance service logs

### Database Errors
- Verify migration ran successfully
- Check database connection
- Verify foreign key constraints

## Next Steps

1. **Integrate Wallet System**: Connect to actual user wallet addresses
2. **Implement Signing**: Add transaction signing flow
3. **Test on Testnet**: Use real Stellar testnet accounts
4. **Add Monitoring**: Set up alerts and dashboards
5. **Load Testing**: Test with multiple concurrent transfers

## Support

- Documentation: `src/transfer/README.md`
- Implementation Guide: `TRANSFER_IMPLEMENTATION.md`
- Code: `src/transfer/`
- Tests: `src/transfer/transfer.service.spec.ts`
