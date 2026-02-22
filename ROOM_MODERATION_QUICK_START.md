# Room Moderation API - Quick Reference

## Endpoints

### 1. Close Room
**Route:** `POST /admin/rooms/:roomId/close`  
**Required Role:** MODERATOR, ADMIN, or SUPER_ADMIN  
**Status Code:** 200 OK  

**Request:**
```json
{
  "reason": "Violation of community guidelines - spam detected"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room closed successfully",
  "room": {
    "id": "uuid",
    "name": "room-name",
    "isClosed": true,
    "closedAt": "2026-02-21T12:00:00Z",
    "closedBy": "admin-uuid",
    "closeReason": "Violation of community guidelines - spam detected"
  }
}
```

**WebSocket Event (to room members):**
```json
{
  "event": "room-closed",
  "reason": "Violation of community guidelines - spam detected",
  "closedAt": "2026-02-21T12:00:00Z",
  "systemMessage": {
    "type": "system", 
    "content": "Room has been closed by moderator. Reason: Violation...",
    "createdAt": "2026-02-21T12:00:00Z"
  }
}
```

---

### 2. Delete Room
**Route:** `DELETE /admin/rooms/:roomId`  
**Required Role:** ADMIN or SUPER_ADMIN  
**Status Code:** 200 OK  

**Request:**
```json
{
  "reason": "Rule violation - illegal content",
  "forceRefund": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room deleted successfully",
  "refundedAmount": "1.50000000"
}
```

**Behavior:**
- Marks room as `isDeleted = true` (soft delete)
- Soft-deletes all messages in room
- Auto-refunds entry fees if room < 24 hours old
- With `forceRefund: true` (SUPER_ADMIN only): refunds regardless of age

**WebSocket Event (to room members):**
```json
{
  "event": "room-deleted",
  "reason": "Rule violation - illegal content",
  "deletedAt": "2026-02-21T12:00:00Z",
  "refunded": true,
  "refundedAmount": "1.50000000",
  "systemMessage": {
    "type": "system",
    "content": "Room has been deleted. Reason: Rule violation...",
    "createdAt": "2026-02-21T12:00:00Z"
  }
}
```

---

### 3. Restore Room
**Route:** `POST /admin/rooms/:roomId/restore`  
**Required Role:** ADMIN or SUPER_ADMIN  
**Status Code:** 200 OK  

**Request:**
```json
{
  "reason": "Appeal approved - content issue resolved by owner"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room restored successfully",
  "room": {
    "id": "uuid",
    "isClosed": false,
    "closedAt": null,
    "isDeleted": false,
    "deletedAt": null
  }
}
```

**WebSocket Event (to room members):**
```json
{
  "event": "room-restored",
  "reason": "Appeal approved - content issue resolved",
  "restoredAt": "2026-02-21T12:00:00Z",
  "systemMessage": {
    "type": "system",
    "content": "Room has been restored. Reason: Appeal approved...",
    "createdAt": "2026-02-21T12:00:00Z"
  }
}
```

---

## Common Use Cases

### Close for Spam
```bash
curl -X POST https://api.example.com/admin/rooms/room-123/close \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Persistent spam - multiple member complaints"}'
```

### Delete with Auto-Refund (new room)
```bash
curl -X DELETE https://api.example.com/admin/rooms/room-456 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Illegal gambling promotion"}'
```

### Force Refund (older room, SUPER_ADMIN only)
```bash
curl -X DELETE https://api.example.com/admin/rooms/room-789 \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Platform policy violation", "forceRefund": true}'
```

### Restore After Appeal
```bash
curl -X POST https://api.example.com/admin/rooms/room-999/restore \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Appeal successful - false positive on initial review"}'
```

---

## Refund Logic

### When Refunds Are Processed
Refunds happen automatically when deleting a room IF:
1. Room is < 24 hours old, AND
2. Room has entry fee > 0, AND
3. Room has completed payments

### When to Use forceRefund
Use `forceRefund: true` when:
- Deleting room older than 24 hours with entry fees
- Appealed cases where refund is approved after review
- Resolving account/payment issues
- **Requires SUPER_ADMIN role**

### Refund Processing
- All completed RoomPayment records are refunded
- Payment status updated to REFUNDED
- Refund transaction hash generated for tracking
- Amount credited back to user
- Audit log includes refund amount

---

## Error Responses

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Room {roomId} not found"
}
```

### 400 Bad Request - Already Closed
```json
{
  "statusCode": 400,
  "message": "Room is already closed or deleted"
}
```

### 400 Bad Request - Can't Restore
```json
{
  "statusCode": 400,
  "message": "Room is not closed or deleted"
}
```

### 403 Forbidden - Insufficient Role
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions to perform this action"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## Audit Trail

### Query Moderation Actions
```bash
GET /admin/audit-logs?resourceType=room&actions=room.closed,room.deleted,room.restored
```

### Response
```json
{
  "logs": [
    {
      "id": "audit-uuid",
      "action": "room.deleted",
      "actorUserId": "admin-uuid",
      "resourceId": "room-uuid",
      "resourceType": "room",
      "details": "Rule violation - illegal content",
      "severity": "high",
      "outcome": "success",
      "metadata": {
        "roomAgeHours": 12,
        "refunded": true,
        "refundedAmount": "1.50000000"
      },
      "createdAt": "2026-02-21T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

## Permissions

| Role | Close | Delete | Restore | Force Refund |
|------|:-----:|:------:|:-------:|:------------:|
| MODERATOR | ✓ | ✗ | ✗ | ✗ |
| ADMIN | ✓ | ✓ | ✓ | ✗ |
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ |

---

## HTTP Status Codes

| StatusCode | Usage |
|:----------:|-------|
| 200 | Successful close, delete, or restore |
| 400 | Bad request (missing fields, invalid room state) |
| 401 | Missing or invalid authentication |
| 403 | Insufficient permissions for this action |
| 404 | Room not found |
| 500 | Server error |

---

## Notes

- All moderation actions are logged with full audit trail
- WebSocket events are broadcast to all connected room members
- Soft-deleted rooms preserve data for legal/audit purposes
- System messages are sent to notify members of actions
- Refund amounts are calculated and tracked per action
- Force refund can only be used by SUPER_ADMIN role
