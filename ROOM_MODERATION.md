# Room Moderation API

## Overview

The Room Moderation API provides administrators and moderators with tools to manage rooms that violate platform policies. This includes closing rooms, soft-deleting rooms with optional refunds, and restoring rooms.

## Endpoints

### 1. Close Room

**Endpoint:** `POST /admin/rooms/:roomId/close`

**Description:** Closes a room, preventing new messages and new members from joining.

**Required Role:** MODERATOR, ADMIN, or SUPER_ADMIN

**Request Body:**
```json
{
  "reason": "Room violates community guidelines"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room closed successfully",
  "room": {
    "id": "uuid",
    "name": "Room Name",
    "isClosed": true,
    "closedAt": "2026-02-21T12:00:00Z",
    "closedBy": "admin-uuid",
    "closeReason": "Room violates community guidelines"
  }
}
```

**WebSocket Broadcast:**
When a room is closed, all connected members receive a room-closed event:
```json
{
  "event": "room-closed",
  "reason": "Room violates community guidelines",
  "closedAt": "2026-02-21T12:00:00Z",
  "systemMessage": {
    "id": "system-timestamp",
    "type": "system",
    "content": "Room has been closed by moderator. Reason: Room violates community guidelines",
    "createdAt": "2026-02-21T12:00:00Z"
  }
}
```

---

### 2. Delete Room

**Endpoint:** `DELETE /admin/rooms/:roomId`

**Description:** Soft-deletes a room and all its messages. If the room has been active for less than 24 hours and has an entry fee, entry fees are refunded to all members who paid.

**Required Role:** ADMIN or SUPER_ADMIN

**Request Body:**
```json
{
  "reason": "Room promotes illegal activity",
  "forceRefund": false
}
```

**Parameters:**
- `reason` (required): Reason for deletion
- `forceRefund` (optional, SUPER_ADMIN only): Force refund even if room is older than 24 hours

**Response:**
```json
{
  "success": true,
  "message": "Room deleted successfully",
  "refundedAmount": "1.50000000"
}
```

**Refund Logic:**
- Refund is issued only if:
  - Room has been active for < 24 hours
  - Room has a non-zero entry fee
  - Room has completed payments
- OR if `forceRefund: true` and user is SUPER_ADMIN
- All refunded payments are marked with status REFUNDED and refund transaction hash
- Entry fees are credited back to members

**WebSocket Broadcast:**
```json
{
  "event": "room-deleted",
  "reason": "Room promotes illegal activity",
  "deletedAt": "2026-02-21T12:00:00Z",
  "refunded": true,
  "refundedAmount": "1.50000000",
  "systemMessage": {
    "id": "system-timestamp",
    "type": "system",
    "content": "Room has been deleted. Reason: Room promotes illegal activity",
    "createdAt": "2026-02-21T12:00:00Z"
  }
}
```

---

### 3. Restore Room

**Endpoint:** `POST /admin/rooms/:roomId/restore`

**Description:** Restores a closed or soft-deleted room, reversing the moderation action.

**Required Role:** ADMIN or SUPER_ADMIN

**Request Body:**
```json
{
  "reason": "Appeal accepted - content issue resolved"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room restored successfully",
  "room": {
    "id": "uuid",
    "name": "Room Name",
    "isClosed": false,
    "closedAt": null,
    "isDeleted": false,
    "deletedAt": null
  }
}
```

**WebSocket Broadcast:**
```json
{
  "event": "room-restored",
  "reason": "Appeal accepted - content issue resolved",
  "restoredAt": "2026-02-21T12:00:00Z",
  "systemMessage": {
    "id": "system-timestamp",
    "type": "system",
    "content": "Room has been restored. Reason: Appeal accepted - content issue resolved",
    "createdAt": "2026-02-21T12:00:00Z"
  }
}
```

---

## Audit Logging

All moderation actions are logged in the audit log with:

- **Action:** `room.closed`, `room.deleted`, or `room.restored`
- **Event Type:** `admin`
- **Outcome:** `success` or `failure`
- **Severity:** `medium` (close/restore) or `high` (delete)
- **Resource Type:** `room`
- **Resource ID:** The room ID
- **Details:** The reason provided by the moderator
- **Metadata:** Additional context (room age for delete, refund amount, etc.)

### Query Audit Logs for Room Actions

```bash
GET /admin/audit-logs?resourceType=room&actions=room.closed,room.deleted,room.restored
```

---

## WebSocket Events

All connected members of a room receive real-time notifications when moderation actions occur:

### Events Emitted
- `room-closed`: Room has been closed
- `room-deleted`: Room has been deleted
- `room-restored`: Room has been restored

Each event includes the reason and timestamp.

---

## Permissions

| Role | Close | Delete | Restore |
|------|-------|--------|---------|
| MODERATOR | ✓ | ✗ | ✗ |
| ADMIN | ✓ | ✓ | ✓ |
| SUPER_ADMIN | ✓ | ✓ | ✓ |

### Special Permissions
- Only SUPER_ADMIN can use `forceRefund: true` when deleting a room

---

## Database Schema Changes

The following fields were added to the `rooms` table:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `isClosed` | BOOLEAN | NO | Whether the room is closed |
| `closedAt` | TIMESTAMP | YES | When the room was closed |
| `closedBy` | UUID | YES | ID of the admin who closed the room |
| `closeReason` | TEXT | YES | Reason for closing |

Note: The `isDeleted` and `deletedAt` columns were already present for soft deletes.

---

## Examples

### Example 1: Close a Room for Spam
```bash
curl -X POST https://api.example.com/admin/rooms/room-123/close \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Excessive spam detected - multiple complaints from members"
  }'
```

### Example 2: Delete a Room with Refund
```bash
curl -X DELETE https://api.example.com/admin/rooms/room-456 \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Room promotes illegal gambling activity",
    "forceRefund": false
  }'
```

### Example 3: Restore a Room
```bash
curl -X POST https://api.example.com/admin/rooms/room-789/restore \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Appeal successful - content issue resolved by room owner"
  }'
```

---

## Related Documentation

- [Audit Logging System](./ADMIN_API.md#audit-logging)
- [Admin Roles and Permissions](./ADMIN_API.md#roles-and-permissions)
- [Room Payment System](./PAYMENT_SYSTEM.md)
