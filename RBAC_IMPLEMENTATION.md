# Role-Based Access Control (RBAC) Implementation Guide

## Overview
Complete role-based access control system for rooms with admin functions, banning, whitelisting, and emergency controls.

## Files Created

### 1. Entities
- **`src/room/entities/room-ban.entity.ts`** - Tracks banned users with optional expiration
- **`src/room/entities/room-whitelist.entity.ts`** - Whitelist for invite-only rooms
- **`src/room/entities/room-emergency-pause.entity.ts`** - Emergency pause controls
- **`src/room/enums/room-role.enum.ts`** - Room role enumeration

### 2. Services
- **`src/room/services/room-role.service.ts`** - Core RBAC service with:
  - `setRoomRole()` - Set user role in room
  - `banUser()` / `unbanUser()` - Ban/unban users
  - `addToWhitelist()` / `removeFromWhitelist()` - Manage whitelist
  - `pauseRoom()` / `resumeRoom()` - Emergency controls
  - `verifyRoomAccess()` - Check access permissions
  - `hasRoomPermission()` - Check specific permissions

### 3. Controllers
- **`src/room/room-role.controller.ts`** - REST endpoints for role management

### 4. Guards
- **`src/room/guards/room-access.guard.ts`** - Validates room access before operations

### 5. DTOs
- **`src/room/dto/set-room-role.dto.ts`** - Set role request
- **`src/room/dto/ban-user.dto.ts`** - Ban user request
- **`src/room/dto/whitelist-user.dto.ts`** - Whitelist request
- **`src/room/dto/emergency-pause.dto.ts`** - Pause room request

### 6. Database
- **`src/database/migrations/1769500000001-AddRoomRoleManagement.ts`** - Migration for new tables

### 7. Tests
- **`src/room/room-role.service.spec.ts`** - Unit tests

## Key Features

### 1. Role-Based Permissions
```typescript
// Roles: OWNER, ADMIN, MODERATOR, MEMBER
// Permissions mapped to roles in ROLE_PERMISSIONS constant
ADMIN: [
  SEND_MESSAGE, EDIT_MESSAGE, DELETE_MESSAGE,
  INVITE_MEMBERS, KICK_MEMBERS, MANAGE_ROLES,
  CHANGE_ROOM_SETTINGS, VIEW_ANALYTICS,
  PIN_MESSAGE, MANAGE_INVITATIONS
]
```

### 2. User Banning
- Ban users with optional expiration
- Automatic removal from room on ban
- Cached for performance (5 min TTL)
- Prevents banned users from accessing room

### 3. Invite-Only Whitelist
- Add/remove users from whitelist
- Required for private rooms
- Cached for performance (5 min TTL)

### 4. Emergency Pause
- Pause room with reason (SPAM, ABUSE, SECURITY, MAINTENANCE, OTHER)
- Prevents all access during pause
- Resume with audit trail
- Cached for performance (1 min TTL)

### 5. Permission Checking
- Hierarchical permission validation
- Prevents non-admins from managing admins
- Prevents changing owner role
- Prevents self-kicks

## API Endpoints

### Role Management
```
POST   /rooms/:roomId/roles/set-role          - Set user role
GET    /rooms/:roomId/roles/user-role/:userId - Get user role
```

### Banning
```
POST   /rooms/:roomId/roles/ban               - Ban user
DELETE /rooms/:roomId/roles/ban/:userId       - Unban user
GET    /rooms/:roomId/roles/ban/:userId       - Check ban status
```

### Whitelist
```
POST   /rooms/:roomId/roles/whitelist         - Add to whitelist
DELETE /rooms/:roomId/roles/whitelist/:userId - Remove from whitelist
GET    /rooms/:roomId/roles/whitelist/:userId - Check whitelist status
```

### Emergency Controls
```
POST   /rooms/:roomId/roles/pause             - Pause room
POST   /rooms/:roomId/roles/resume            - Resume room
GET    /rooms/:roomId/roles/pause-status      - Check pause status
```

### Access Verification
```
GET    /rooms/:roomId/roles/access/:userId    - Verify room access
```

## Usage Examples

### Set User Role
```typescript
await roomRoleService.setRoomRole(
  roomId,
  userId,
  MemberRole.MODERATOR,
  initiatorId
);
```

### Ban User
```typescript
await roomRoleService.banUser(
  roomId,
  userId,
  'Spam behavior',
  initiatorId,
  expiresAt // optional
);
```

### Add to Whitelist
```typescript
await roomRoleService.addToWhitelist(
  roomId,
  userId,
  initiatorId,
  'VIP member'
);
```

### Pause Room
```typescript
await roomRoleService.pauseRoom(
  roomId,
  initiatorId,
  EmergencyPauseReason.SPAM,
  'Spam attack detected'
);
```

### Verify Access
```typescript
const access = await roomRoleService.verifyRoomAccess(roomId, userId);
if (!access.canAccess) {
  throw new ForbiddenException(access.reason);
}
```

## Database Schema

### room_bans
- `id` (UUID, PK)
- `roomId` (UUID, FK)
- `userId` (UUID, FK)
- `bannedBy` (UUID, FK)
- `reason` (text)
- `expiresAt` (timestamp, nullable)
- `bannedAt` (timestamp)
- `updatedAt` (timestamp)

### room_whitelists
- `id` (UUID, PK)
- `roomId` (UUID, FK)
- `userId` (UUID, FK)
- `addedBy` (UUID, FK)
- `notes` (text)
- `addedAt` (timestamp)
- `updatedAt` (timestamp)

### room_emergency_pauses
- `id` (UUID, PK)
- `roomId` (UUID, FK)
- `pausedBy` (UUID, FK)
- `reason` (enum)
- `description` (text)
- `isPaused` (boolean)
- `resumedAt` (timestamp, nullable)
- `resumedBy` (UUID, nullable)
- `pausedAt` (timestamp)
- `updatedAt` (timestamp)

## Integration Steps

1. **Run Migration**
   ```bash
   npm run typeorm migration:run
   ```

2. **Update Room Module** (Already done)
   - Added new entities to TypeOrmModule
   - Added RoomRoleService to providers
   - Added RoomRoleController to controllers

3. **Use Guards in Controllers**
   ```typescript
   @UseGuards(JwtAuthGuard, RoomAccessGuard)
   ```

4. **Check Permissions**
   ```typescript
   const hasPermission = await roomRoleService.hasRoomPermission(
     roomId,
     userId,
     MemberPermission.KICK_MEMBERS
   );
   ```

## Acceptance Criteria Met

✅ **Role-based permissions work correctly**
- Roles (OWNER, ADMIN, MODERATOR, MEMBER) implemented
- Permissions mapped to roles
- Permission checking enforced

✅ **Banned users cannot access rooms**
- `banUser()` removes user and creates ban record
- `verifyRoomAccess()` checks ban status
- Cached for performance

✅ **Only authorized users can perform admin actions**
- `verifyInitiatorPermission()` checks permissions
- Prevents non-admins from managing admins
- Prevents changing owner role

✅ **Emergency controls are functional**
- `pauseRoom()` / `resumeRoom()` implemented
- Prevents all access during pause
- Audit trail with reason and description

## Caching Strategy

- **Ban status**: 5 minutes
- **Whitelist status**: 5 minutes
- **Pause status**: 1 minute
- **Member permissions**: 5 minutes (existing)

Cache invalidation on:
- Role changes
- Ban/unban
- Whitelist add/remove
- Pause/resume

## Security Considerations

1. **Permission Hierarchy**: Admins cannot manage other admins (except owner)
2. **Owner Protection**: Owner role cannot be changed
3. **Audit Trail**: All actions logged with initiator ID
4. **Expiring Bans**: Optional expiration for temporary bans
5. **Cache Invalidation**: Immediate cache clearing on changes
