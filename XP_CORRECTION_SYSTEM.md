# XP Correction System

## Overview

The XP Correction System allows administrators to adjust user XP for edge cases including:
- **Exploit Mitigation**: Removing XP gained through exploits
- **Compensation**: Adding XP to compensate for system issues
- **Contest Rewards**: Awarding XP for competition winners
- **Correction**: Fixing accidental XP transactions

## API Endpoint

### Adjust User XP

**Endpoint:** `PATCH /admin/users/:id/xp`

**Authentication:** Bearer token with ADMIN role

**Request Body:**
```json
{
  "delta": -500,
  "reason": "Exploit mitigation - duplicate quest rewards"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| delta | number | Yes | XP change amount (positive or negative). Range: -999999 to 999999 |
| reason | string | Yes | Explanation for the adjustment (max 500 characters) |

**Response (Success):**
```json
{
  "success": true,
  "message": "XP adjusted successfully. Previous: 5000, New: 4500, Delta: -500",
  "user": {
    "id": "user-123",
    "username": "testuser",
    "currentXp": 4500,
    "level": 5
  },
  "previousXp": 5000,
  "newXp": 4500,
  "delta": -500,
  "oldLevel": 6,
  "newLevel": 5,
  "levelChanged": true
}
```

**Response Codes:**

| Code | Reason | Example |
|------|--------|---------|
| 200 | XP adjusted successfully | See above |
| 400 | Invalid adjustment (would result in negative XP) | `{ "message": "XP adjustment would result in negative XP..." }` |
| 404 | User not found | `{ "message": "User with ID user-123 not found" }` |
| 403 | Insufficient permissions | User lacks ADMIN role |

## Business Logic

### Level Calculation
Levels are calculated using the formula:
```
level = floor(total_xp / 1000) + 1
```

**Examples:**
- 0 XP → Level 1
- 999 XP → Level 1
- 1000 XP → Level 2
- 5999 XP → Level 6
- 10000 XP → Level 11

### XP Boundaries
- **Minimum:** 0 XP (level 1)
- **Maximum:** No limit
- **Adjustment Range:** -999,999 to +999,999 per request

### Validation

1. **User Existence Check**
   - Returns 404 if user not found

2. **XP Validation**
   - New XP must be ≥ 0
   - Returns 400 if adjustment would go below 0

3. **Reason Validation**
   - Required field
   - Maximum 500 characters

## Behavior

### Level Crossing

**Level Up Event:**
- Triggered when `newLevel > oldLevel`
- Queues `LEVEL_UP` notification
- Includes metadata: old level, new level, current XP, admin adjustment flag

**Level Down Event:**
- Triggered when `newLevel < oldLevel`
- Queues `LEVEL_DOWN` notification
- Includes metadata: old level, new level, current XP, admin adjustment flag

**No Change:**
- If level stays the same, no notifications are sent
- Leaderboard is still updated if XP changes

### Leaderboard Update
- Always updated when `delta ≠ 0`
- Uses actual delta value for score increment
- Leaderboard category: XP

### Audit Logging
- All adjustments logged with `USER_XP_ADJUSTED` action
- Logged metadata includes:
  - Admin ID who made adjustment
  - User ID who gained/lost XP
  - Previous XP value
  - New XP value
  - Delta value
  - Old level
  - New level
  - Adjustment reason
  - IP address and user agent

## Use Cases

### Case 1: Exploit Mitigation
A user gains 5000 XP through exploiting a quest reward system that allowed duplicate completions.

```bash
curl -X PATCH https://api.example.com/admin/users/user-123/xp \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "delta": -5000,
    "reason": "Exploit mitigation - duplicate quest rewards (quests 5, 7, 12)"
  }'
```

### Case 2: Compensation
Server was down for 3 hours, preventing normal XP gains. Compensate affected users.

```bash
curl -X PATCH https://api.example.com/admin/users/user-456/xp \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "delta": 500,
    "reason": "Compensation for 3-hour server downtime (2024-01-15 10:00-13:00 UTC)"
  }'
```

### Case 3: Contest Reward
Top 3 winners of weekly contest receive bonus XP.

```bash
curl -X PATCH https://api.example.com/admin/users/user-789/xp \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "delta": 2000,
    "reason": "1st place winner - Weekly Challenge #42"
  }'
```

### Case 4: Correction
Fix accidental double XP payout from a system error.

```bash
curl -X PATCH https://api.example.com/admin/users/user-999/xp \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "delta": -300,
    "reason": "System error correction - double payout on 2024-01-14 (activity id: act-555)"
  }'
```

## Integration Points

### 1. XpService Integration
- Uses `calculateLevel()` for consistent level calculation
- Follows same XP multiplier patterns (if needed in future)

### 2. Leaderboard Integration
- `LeaderboardService.updateLeaderboard()` called with delta
- Category: `LeaderboardCategory.XP`
- Updates user ranking in real-time

### 3. Notification System
- Queues notifications via `NotificationsQueue`
- LEVEL_UP and LEVEL_DOWN events
- Includes admin adjustment flag for custom UI rendering

### 4. Audit System
- `AuditLogService.log()` with full metadata
- Action: `AuditAction.USER_XP_ADJUSTED`
- Severity: MEDIUM
- All administrative changes tracked for compliance

## Authorization

**Minimum Role Required:** ADMIN

Only users with the ADMIN role can adjust XP. Attempts by lower-privileged users will receive a 403 Forbidden response.

If MODERATOR role needs this capability in the future, add to controller guard:
```typescript
@Permissions(['adjustXp'])
```

## Error Handling

### Scenario: Negative XP Result

**Request:**
```json
{
  "delta": -6000,
  "reason": "Major deduction"
}
```

User has 5000 XP (Level 6). Requested delta would result in -1000 XP.

**Response (400):**
```json
{
  "statusCode": 400,
  "message": "XP adjustment would result in negative XP. Current: 5000, Delta: -6000. New XP would be: -1000",
  "error": "Bad Request"
}
```

### Scenario: User Not Found

**Request:**
```
PATCH /admin/users/non-existent-id/xp
```

**Response (404):**
```json
{
  "statusCode": 404,
  "message": "User with ID non-existent-id not found",
  "error": "Not Found"
}
```

### Scenario: Insufficient Permissions

**User Role:** MODERATOR
**Request:** PATCH /admin/users/:id/xp

**Response (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

## Testing

The feature includes comprehensive unit tests covering:

- ✅ Increasing user XP with level up
- ✅ Decreasing user XP with level down
- ✅ Edge case: XP becomes exactly 0
- ✅ Negative XP prevention
- ✅ User not found handling
- ✅ Level up notifications
- ✅ Level down notifications
- ✅ No notifications when level unchanged
- ✅ Leaderboard updates
- ✅ Leaderboard skip when delta is 0
- ✅ Audit log creation
- ✅ Large positive adjustments
- ✅ Large negative adjustments

**Test File:** `src/admin/services/tests/admin-xp-adjustment.spec.ts`

**Run Tests:**
```bash
npm run test -- admin-xp-adjustment.spec.ts
```

## Database Considerations

### User Entity Updates
- `currentXp` field updated
- `level` field updated
- `updatedAt` timestamp updated

### Audit Log Entry
- New row created in `audit_logs` table
- Contains full adjustment details
- Timestamp automatically set

### XpHistory
- No automatic entry created (admin adjustments are tracked in audit logs instead)
- For future enhancement: create separate XpAdjustment entity if detailed XP history tracking needed

## Monitoring & Alerts

### Recommended Alerts

1. **Large XP Adjustments**
   - Alert if `abs(delta) > 10000` in single request
   - May indicate system error or investigation needed

2. **Bulk XP Adjustments**
   - Alert if multiple users get XP adjustment same day
   - May indicate widespread issue requiring root cause analysis

3. **Negative Adjustments**
   - Alert if `delta < 0` for same user multiple times
   - May indicate repeated exploit or performance issue

### Audit Log Queries

**Find all XP adjustments by date:**
```sql
SELECT * FROM audit_logs 
WHERE action = 'user.xp.adjusted' 
AND created_at BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY created_at DESC;
```

**Find all adjustments for specific user:**
```sql
SELECT * FROM audit_logs 
WHERE action = 'user.xp.adjusted' 
AND resource_id = 'user-123'
ORDER BY created_at DESC;
```

**Find all adjustments by specific admin:**
```sql
SELECT * FROM audit_logs 
WHERE action = 'user.xp.adjusted' 
AND actor_user_id = 'admin-456'
ORDER BY created_at DESC;
```

## Future Enhancements

1. **Batch XP Adjustments**
   - Support adjusting multiple users at once
   - Transaction rollback on any failure

2. **XP Adjustment History**
   - Create separate XpAdjustment entity
   - Track all admin corrections over time
   - Compare system vs admin-adjusted XP totals

3. **Approval Workflow**
   - Large adjustments require second admin approval
   - Audit trail of who requested and who approved

4. **Scheduled Adjustments**
   - Schedule future XP changes
   - Example: Delayed compensation after verification period

5. **XP Adjustment Reports**
   - Dashboard showing adjustment patterns
   - Identify users with most adjustments
   - Flag potential fraud patterns
