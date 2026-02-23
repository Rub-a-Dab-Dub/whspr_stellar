# Room Moderation Implementation Summary

## Overview
Implemented complete room moderation system allowing administrators and moderators to manage rooms that violate platform policies through closing, soft-deleting with optional refunds, and restoring rooms.

## Files Created/Modified

### Entity & Database Changes
1. **[src/room/entities/room.entity.ts](src/room/entities/room.entity.ts)**
   - Added `isClosed: boolean` - Flag to track closed rooms
   - Added `closedAt: Date` - Timestamp of closure
   - Added `closedBy: uuid` - Admin ID who closed the room
   - Added `closeReason: string` - Reason for closing

2. **[src/database/migrations/1771700000000-AddRoomModerationFields.ts](src/database/migrations/1771700000000-AddRoomModerationFields.ts)**
   - Migration to add moderation fields to rooms table
   - Creates indexes for efficient querying: isClosed, closedAt, isDeleted

### DTOs (Data Transfer Objects)
3. **[src/admin/dto/close-room.dto.ts](src/admin/dto/close-room.dto.ts)**
   - `CloseRoomDto` with required `reason` field

4. **[src/admin/dto/delete-room.dto.ts](src/admin/dto/delete-room.dto.ts)**
   - `DeleteRoomDto` with `reason` and optional `forceRefund` fields

5. **[src/admin/dto/restore-room.dto.ts](src/admin/dto/restore-room.dto.ts)**
   - `RestoreRoomDto` with required `reason` field

### API Controllers
6. **[src/admin/controllers/admin.controller.ts](src/admin/controllers/admin.controller.ts)**
   - `POST /admin/rooms/:roomId/close` - Close room (requires MODERATOR+)
   - `DELETE /admin/rooms/:roomId` - Delete room (requires ADMIN+)
   - `POST /admin/rooms/:roomId/restore` - Restore room (requires ADMIN+)
   - Integrated with role-based access control

### Business Logic
7. **[src/admin/services/admin.service.ts](src/admin/services/admin.service.ts)**
   - `closeRoom()` - Closes room, prevents new messages/members
   - `deleteRoom()` - Soft-deletes room and all its messages
   - `restoreRoom()` - Reverses closure or deletion
   - `refundRoomEntryFees()` - Internal method for processing refunds
   - Uses WebSocket broadcasting for real-time updates
   - Integrated audit logging for all actions

### Audit Trail
8. **[src/admin/entities/audit-log.entity.ts](src/admin/entities/audit-log.entity.ts)**
   - Added `AuditAction` enums:
     - `ROOM_CLOSED = 'room.closed'`
     - `ROOM_DELETED = 'room.deleted'`
     - `ROOM_RESTORED = 'room.restored'`

### Documentation
9. **[ROOM_MODERATION.md](ROOM_MODERATION.md)**
   - Complete API documentation with examples
   - Refund logic explanation
   - Permission matrix
   - WebSocket event specifications

## Key Features Implemented

### 1. Room Closing
- Prevents new messages in closed rooms
- Prevents new members from joining
- Broadcasts system message via WebSocket
- Requires MODERATOR role minimum
- Audit logged with reason

### 2. Room Deletion
- Soft-delete: marks room as deleted without removing data
- Soft-delete all messages in room
- Entry fee refund logic:
  - Refunds if room < 24 hours old AND has entry fee
  - Processes refund through room payments table
  - Supports force refund for SUPER_ADMIN role
- Broadcasts deletion event with refund details
- Requires ADMIN role minimum
- High-severity audit log entry

### 3. Room Restoration
- Reverses both closure and deletion status
- Restores messages marked as deleted
- Clears moderation metadata
- Broadcasts restoration event
- Requires ADMIN role minimum
- All changes audit logged

### 4. WebSocket Broadcasting
- Uses existing MessagesGateway infrastructure
- Events: `room-closed`, `room-deleted`, `room-restored`
- Each event includes reason, timestamp, and system message
- Connected members receive real-time notifications

### 5. Audit Logging
- Complete audit trail for all moderation actions
- Logs moderator identity, action, reason, timestamp
- Includes metadata (room age for refund decisions, amounts, etc.)
- Queryable via existing audit log endpoints

### 6. Refund Processing
- Queries RoomPayment records for completed payments
- Updates payment status to REFUNDED
- Generates refund transaction hash tracking
- Handles multiple payments per room
- Gracefully handles transactional failures

## Permission Model

| Action | MODERATOR | ADMIN | SUPER_ADMIN |
|--------|:---------:|:-----:|:-----------:|
| Close Room | ✓ | ✓ | ✓ |
| Delete Room | ✗ | ✓ | ✓ |
| Force Refund | ✗ | ✗ | ✓ |
| Restore Room | ✗ | ✓ | ✓ |

## API Endpoint Examples

### Close Room
```bash
POST /admin/rooms/{roomId}/close
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Violation of community guidelines"
}
```

### Delete Room (with optional refund)
```bash
DELETE /admin/rooms/{roomId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Room promotes illegal gambling",
  "forceRefund": false
}
```

### Restore Room
```bash
POST /admin/rooms/{roomId}/restore
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Appeal approved - issue resolved"
}
```

## Database Schema

### Added to `rooms` table:
- `isClosed BOOLEAN DEFAULT false` - Room closure status
- `closedAt TIMESTAMP NULL` - When room was closed
- `closedBy UUID NULL` - Admin who closed the room
- `closeReason TEXT NULL` - Reason for closure
- Index on `isClosed` for filtering
- Index on `closedAt` for sorting
- Index on `isDeleted` for room listing

Note: `isDeleted` and `deletedAt` columns were already present for soft deletes.

## Implementation Notes

1. **Soft Deletes**: Room deletion uses soft-delete pattern with `isDeleted` flag, preserving data for audit/legal compliance.

2. **Message Updates**: Uses TypeORM query builder for bulk message soft-deletion:
   - `messageRepository.createQueryBuilder().update().where('message.roomId = ?').execute()`

3. **Refund Integration**: 
   - Works with existing `RoomPayment` entity
   - Updates payment status to `REFUNDED`
   - Logs refund transaction hashes for tracking

4. **WebSocket Integration**:
   - Reuses existing `MessagesGateway.broadcastToRoom()` method
   - Events sent to `room:{roomId}` namespace
   - Includes system message payload for UI display

5. **Audit Logging**:
   - Uses existing `AuditLogService.log()` method
   - Includes metadata for comprehensive tracking
   - Queryable via `/admin/audit-logs` endpoints

## Testing Checklist

- [ ] Close room (MODERATOR can execute)
- [ ] Close room broadcasts WebSocket event
- [ ] Cannot close already-closed room
- [ ] Delete room (ADMIN can execute)
- [ ] Delete with auto-refund (< 24 hrs)
- [ ] Delete without refund (> 24 hrs)
- [ ] Force refund (SUPER_ADMIN only)
- [ ] Messages soft-deleted with room
- [ ] Restore room (reverses closure)
- [ ] Restore room (reverses deletion)
- [ ] Restore recovers soft-deleted messages
- [ ] Audit logs all actions correctly
- [ ] WebSocket events received in real-time
- [ ] Permissions enforced correctly

## Integration Points

- **Existing Gateways**: MessagesGateway for WebSocket broadcasts
- **Existing Services**: AuditLogService for audit trails
- **Existing Repositories**: RoomRepository, MessageRepository, RoomPaymentRepository
- **Existing Models**: Room, Message, RoomPayment entities
- **Existing Guards**: RoleGuard, PermissionGuard for access control

All components integrate seamlessly with existing infrastructure.
