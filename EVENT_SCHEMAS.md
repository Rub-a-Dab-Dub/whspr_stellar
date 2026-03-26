# Contract Event Schemas

All Soroban contract events follow a structured topic array convention and are indexed into the `contract_events` PostgreSQL table by the `EventIndexerService`.

---

## Topic Array Convention

```
topics[0]  →  event name (ScvSymbol)       — always present, used as primary filter
topics[1]  →  first indexed field           — address, room ID, etc.
topics[2]  →  second indexed field          — optional
value      →  ScvMap with full event data   — decoded to JSON in `payload` column
```

---

## Events

### `message_sent`

Emitted when a user sends a message in a room.

| Field | Topics index | Type |
|---|---|---|
| event name | 0 | Symbol: `"message_sent"` |
| roomId | 1 | String |
| sender | 2 | Address |

**Payload (`value` map):**
```json
{
  "messageId": "string",
  "roomId": "string",
  "sender": "G...",
  "contentHash": "ipfs://...",
  "timestamp": 1711234567
}
```

---

### `message_deleted`

Emitted when a message is deleted.

| Field | Topics index | Type |
|---|---|---|
| event name | 0 | Symbol: `"message_deleted"` |
| roomId | 1 | String |

**Payload:**
```json
{
  "messageId": "string",
  "roomId": "string",
  "deletedBy": "G..."
}
```

---

### `tip_sent`

Emitted when a user tips another user in a chat.

| Field | Topics index | Type |
|---|---|---|
| event name | 0 | Symbol: `"tip_sent"` |
| from | 1 | Address |
| to | 2 | Address |

**Payload:**
```json
{
  "from": "G...",
  "to": "G...",
  "amount": "1000000000",
  "token": "C...",
  "platformFee": "20000000",
  "roomId": "string"
}
```
> Amounts are i128 serialized as strings. Platform fee = 2% of amount.

---

### `room_created`

Emitted when a new room is created.

| Field | Topics index | Type |
|---|---|---|
| event name | 0 | Symbol: `"room_created"` |
| creator | 1 | Address |

**Payload:**
```json
{
  "roomId": "string",
  "creator": "G...",
  "entryFee": "0",
  "isTokenGated": false,
  "expiresAt": null
}
```

---

### `room_joined`

Emitted when a user joins a room (paying entry fee if applicable).

| Field | Topics index | Type |
|---|---|---|
| event name | 0 | Symbol: `"room_joined"` |
| roomId | 1 | String |
| member | 2 | Address |

**Payload:**
```json
{
  "roomId": "string",
  "member": "G...",
  "feePaid": "0"
}
```

---

### `room_expired`

Emitted when a timed room auto-expires.

| Field | Topics index | Type |
|---|---|---|
| event name | 0 | Symbol: `"room_expired"` |
| roomId | 1 | String |

**Payload:**
```json
{
  "roomId": "string",
  "expiredAt": 1711234567
}
```

---

### `transfer_sent`

Emitted on P2P token transfers (no platform fee).

| Field | Topics index | Type |
|---|---|---|
| event name | 0 | Symbol: `"transfer_sent"` |
| from | 1 | Address |
| to | 2 | Address |

**Payload:**
```json
{
  "from": "G...",
  "to": "G...",
  "amount": "5000000000",
  "token": "C..."
}
```

---

### `xp_awarded`

Emitted when XP is granted to a user.

| Field | Topics index | Type |
|---|---|---|
| event name | 0 | Symbol: `"xp_awarded"` |
| user | 1 | Address |

**Payload:**
```json
{
  "user": "G...",
  "amount": 10,
  "reason": "message",
  "totalXp": 1340
}
```
> `reason` values: `"message"` (+10 XP), `"tip"` (+20 XP), `"room_create"` (+50 XP)

---

### `level_up`

Emitted when a user crosses a level threshold (every 1000 XP).

| Field | Topics index | Type |
|---|---|---|
| event name | 0 | Symbol: `"level_up"` |
| user | 1 | Address |

**Payload:**
```json
{
  "user": "G...",
  "newLevel": 3,
  "totalXp": 3000
}
```

---

## Database Schema

```sql
contract_events (
  id               uuid PRIMARY KEY,
  contractId       varchar(64),   -- Stellar C... address
  ledgerSequence   bigint,        -- for ordering and cursor tracking
  txHash           varchar(64),
  eventIndex       int,
  topic0           varchar(64),   -- event name, primary filter column
  topic1           varchar(128),  -- first indexed field
  topic2           varchar(128),  -- second indexed field
  payload          jsonb,         -- decoded event data
  rawValueXdr      text,          -- original XDR for auditability
  processed        boolean,       -- consumed by downstream services
  indexedAt        timestamp,
  UNIQUE (txHash, eventIndex)     -- deduplication key
)

indexer_cursors (
  contractId   varchar(64) PRIMARY KEY,
  lastLedger   bigint,            -- resume point after restart
  updatedAt    timestamp
)
```

---

## NestJS Integration

```typescript
// Inject EventIndexerService and query events
const [events, total] = await eventIndexer.findByContract(
  'C...',           // contractId
  'tip_sent',       // topic0 filter (optional)
  1,                // page
  50,               // limit
);

// Get typed payload
const payload = await eventIndexer.getTypedPayload<'tip_sent'>(events[0]);
// payload.amount, payload.from, payload.to are fully typed
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `SOROBAN_RPC_URL` | Soroban RPC endpoint (e.g. `https://soroban-testnet.stellar.org`) |
| `SOROBAN_CONTRACT_IDS` | Comma-separated list of contract addresses to index |
