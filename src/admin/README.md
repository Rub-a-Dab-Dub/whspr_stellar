# Admin Dashboard API

Admin-only endpoints for platform analytics and monitoring.

## Setup

### 1. Run Migration

```bash
npm run migration:run
```

### 2. Set Admin Role

Update a user to have admin access:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

### 3. Environment Variables

Ensure Redis is configured in your `.env`:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

## API Endpoints

All endpoints require:
- Valid JWT token (Authorization: Bearer <token>)
- User role = 'ADMIN'

### GET /admin/stats/overview

Platform overview with key metrics.

**Response:**
```json
{
  "totalUsers": 1250,
  "dau": 340,
  "mau": 890,
  "totalRooms": 45,
  "transactions24h": 127
}
```

**Cache:** 5 minutes

---

### GET /admin/stats/users

User registration over time.

**Query Parameters:**
- `period` (optional): `day` | `week` | `month` | `year` (default: `month`)
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 30)

**Response:**
```json
{
  "data": [
    { "date": "2026-02-01", "count": 45 },
    { "date": "2026-02-02", "count": 52 }
  ],
  "total": 1250,
  "page": 1,
  "limit": 30
}
```

**Cache:** 5 minutes per query combination

---

### GET /admin/stats/messages

Message volume over time.

**Query Parameters:** Same as `/users`

**Response:**
```json
{
  "data": [
    { "date": "2026-02-01", "count": 1240 },
    { "date": "2026-02-02", "count": 1580 }
  ],
  "total": 45230,
  "page": 1,
  "limit": 30
}
```

**Cache:** 5 minutes

---

### GET /admin/stats/payments

Transaction volume and fee collection by date.

**Query Parameters:** Same as `/users`

**Response:**
```json
{
  "data": [
    {
      "date": "2026-02-01",
      "count": 127,
      "volume": "1250.50",
      "fees": "25.01"
    },
    {
      "date": "2026-02-02",
      "count": 145,
      "volume": "1890.75",
      "fees": "37.82"
    }
  ],
  "total": 5420,
  "page": 1,
  "limit": 30
}
```

**Cache:** 5 minutes

---

### GET /admin/stats/rooms

Room statistics (active, new, expired).

**Response:**
```json
{
  "activeRooms": 45,
  "newRooms": 8,
  "expiredRooms": 0
}
```

**Cache:** 5 minutes

---

## Testing

```bash
# Get JWT token
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Use token for admin endpoints
curl http://localhost:3001/admin/stats/overview \
  -H "Authorization: Bearer <your-token>"
```

## Implementation Details

- **Caching:** All endpoints use Redis with 5-minute TTL
- **Authorization:** JWT + AdminGuard (checks role = 'ADMIN')
- **Pagination:** Time-series endpoints support page/limit
- **Date Ranges:** Flexible filtering with period presets or custom dates
- **Performance:** Aggregation queries optimized with indexes
