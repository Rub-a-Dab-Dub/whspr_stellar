# API DOCUMENTATION

# ==================

## Base URL

```
http://localhost:3000
```

## Authentication

All endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

## Security Alerts Endpoints

### 1. List All Alerts

**Endpoint:** `GET /admin/security/alerts`

**Required Role:** ADMIN or SUPER_ADMIN

**Query Parameters:**

- `severity` (optional): Filter by severity - `low`, `medium`, `high`, `critical`
- `status` (optional): Filter by status - `open`, `acknowledged`, `resolved`
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Example Request:**

```bash
curl -X GET "http://localhost:3000/admin/security/alerts?severity=high&status=open&page=1&limit=20" \
  -H "Authorization: Bearer your-jwt-token"
```

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "rule": "spam",
      "severity": "medium",
      "status": "open",
      "userId": "user-123",
      "adminId": null,
      "details": {
        "messageCount": 150,
        "timeWindow": "1 minute",
        "threshold": 100
      },
      "note": null,
      "createdAt": "2026-02-21T10:30:00Z",
      "updatedAt": "2026-02-21T10:30:00Z",
      "acknowledgedAt": null,
      "resolvedAt": null
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

---

### 2. Get Specific Alert

**Endpoint:** `GET /admin/security/alerts/:alertId`

**Required Role:** ADMIN or SUPER_ADMIN

**Path Parameters:**

- `alertId` (required): UUID of the alert

**Example Request:**

```bash
curl -X GET "http://localhost:3000/admin/security/alerts/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer your-jwt-token"
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "rule": "wash_trading",
    "severity": "high",
    "status": "open",
    "userId": "user-456",
    "details": {
      "tipCount": 15,
      "uniqueSenderCount": 12,
      "timeWindow": "5 minutes",
      "threshold": 10
    },
    "createdAt": "2026-02-21T10:15:00Z"
  }
}
```

**Error Response (404):**

```json
{
  "message": "Alert not found"
}
```

---

### 3. Update Alert Status

**Endpoint:** `PATCH /admin/security/alerts/:alertId`

**Required Role:**

- ADMIN: Can acknowledge alerts
- SUPER_ADMIN: Can acknowledge or resolve alerts

**Path Parameters:**

- `alertId` (required): UUID of the alert

**Request Body:**

```json
{
  "status": "acknowledged",
  "note": "Investigating this alert - seems like legitimate bulk messaging"
}
```

**Status Values:**

- `acknowledged`: Alert reviewed by admin
- `resolved`: Alert fully investigated and resolved (SUPER_ADMIN only)

**Example Request:**

```bash
curl -X PATCH "http://localhost:3000/admin/security/alerts/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "acknowledged",
    "note": "User is a known bulk messenger, rule threshold adjusted"
  }'
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "rule": "spam",
    "severity": "medium",
    "status": "acknowledged",
    "userId": "user-123",
    "note": "User is a known bulk messenger, rule threshold adjusted",
    "acknowledgedAt": "2026-02-21T10:35:00Z"
  }
}
```

**Error Responses:**

404 - Alert not found:

```json
{
  "message": "Alert not found"
}
```

403 - Insufficient permissions:

```json
{
  "message": "Only SUPER_ADMIN can resolve alerts"
}
```

400 - Invalid status:

```json
{
  "message": "Invalid status. Allowed values: open, acknowledged, resolved"
}
```

---

## WebSocket Events

### Connection

Connect to the WebSocket server on the `security` namespace:

**URL:** `ws://localhost:3000/security`

**Query Parameters:**

- `userId` (required): Current user ID
- `role` (required): User role (must be ADMIN or SUPER_ADMIN)

**JavaScript Example:**

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/security', {
  query: {
    userId: 'current-user-id',
    role: 'ADMIN',
  },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected to security alerts');
});

socket.on('security.alert', (alert) => {
  console.log('New security alert:', alert);
  // Alert structure:
  // {
  //   id: string,
  //   rule: string,
  //   severity: 'high' | 'critical',
  //   status: string,
  //   details: object,
  //   userId?: string,
  //   createdAt: Date
  // }
});

socket.on('disconnect', () => {
  console.log('Disconnected from security alerts');
});
```

### Events Emitted

**security.alert** - Triggered when high/critical severity alert is created

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "rule": "admin_new_ip",
  "severity": "critical",
  "status": "open",
  "details": {
    "ipAddress": "203.0.113.42",
    "timestamp": "2026-02-21T10:45:00Z"
  },
  "adminId": "admin-789",
  "createdAt": "2026-02-21T10:45:00Z"
}
```

Only `high` and `critical` severity alerts are emitted to WebSocket.

---

## HTTP Status Codes

| Code | Description                          |
| ---- | ------------------------------------ |
| 200  | Successful request                   |
| 400  | Bad request (invalid parameters)     |
| 401  | Unauthorized (missing/invalid token) |
| 403  | Forbidden (insufficient permissions) |
| 404  | Resource not found                   |
| 500  | Internal server error                |

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider adding:

- Per-user rate limiting: 100 requests/minute
- IP-based rate limiting: 1000 requests/minute

---

## Examples

### Example: Get all critical open alerts

```bash
curl -X GET "http://localhost:3000/admin/security/alerts?severity=critical&status=open" \
  -H "Authorization: Bearer eyJhbGc..."
```

### Example: Acknowledge and add note to alert

```bash
curl -X PATCH "http://localhost:3000/admin/security/alerts/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "acknowledged",
    "note": "False positive - user is legitimate"
  }'
```

### Example: Resolve alert (SUPER_ADMIN only)

```bash
curl -X PATCH "http://localhost:3000/admin/security/alerts/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "note": "Spam block rule updated, user whitelisted"
  }'
```

export default {};
