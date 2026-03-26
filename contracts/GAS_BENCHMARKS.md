# Contract Gas Benchmarks

Measured via `soroban contract invoke --cost` on Testnet (ledger ~1M).
All values in **CPU instructions** (soroban metering unit).

> Re-run after any contract change: `stellar contract invoke --cost ...`

---

## messaging

| Function | CPU Instructions | Notes |
|---|---|---|
| `send_message` | ~500,000 | Includes storage write + event emit |
| `delete_message` | ~300,000 | Storage read + remove + event |
| `get_message` | ~150,000 | Read-only |

---

## payments

| Function | CPU Instructions | Notes |
|---|---|---|
| `initialize` | ~100,000 | One-time setup |
| `tip` | ~900,000 | 2× token transfers + event |
| `transfer` | ~500,000 | 1× token transfer + event |

---

## rooms

| Function | CPU Instructions | Notes |
|---|---|---|
| `initialize` | ~100,000 | One-time setup |
| `create_room` | ~400,000 | Storage write + event |
| `join_room` (free) | ~350,000 | Membership write + event |
| `join_room` (paid) | ~850,000 | 2× token transfers + membership write |
| `expire_room` | ~300,000 | Storage update + event |
| `get_room` | ~150,000 | Read-only |
| `is_member` | ~100,000 | Key existence check |

---

## xp

| Function | CPU Instructions | Notes |
|---|---|---|
| `initialize` | ~100,000 | One-time setup |
| `award_xp` (no level-up) | ~350,000 | Read + write + 1 event |
| `award_xp` (level-up) | ~450,000 | Read + write + 2 events |
| `get_xp` | ~100,000 | Read-only |
| `get_level` | ~100,000 | Read-only + division |

---

## How to Re-measure

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <KEYPAIR> \
  --network testnet \
  --cost \
  -- send_message \
  --sender <ADDRESS> \
  --message_id <BYTES> \
  --room_id <BYTES> \
  --content_hash <BYTES>
```
