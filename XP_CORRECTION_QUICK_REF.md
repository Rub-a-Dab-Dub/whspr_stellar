# XP Correction System - Quick Reference

## Quick API Call

```bash
# Add XP (compensation/reward)
curl -X PATCH https://api.example.com/admin/users/user-id/xp \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"delta": 1000, "reason": "Contest reward"}'

# Remove XP (exploit mitigation)
curl -X PATCH https://api.example.com/admin/users/user-id/xp \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"delta": -500, "reason": "Exploit mitigation"}'
```

## Request Format

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| delta | number | Yes | -999999 to +999999, can be negative |
| reason | string | Yes | max 500 chars, non-empty |

## Response Format

```json
{
  "success": true,
  "message": "XP adjusted successfully...",
  "previousXp": 5000,
  "newXp": 6000,
  "delta": 1000,
  "oldLevel": 6,
  "newLevel": 7,
  "levelChanged": true
}
```

## Level Formula

```
level = floor(xp / 1000) + 1
```

**Examples:**
| XP | Level |
|----|-------|
| 0-999 | 1 |
| 1000-1999 | 2 |
| 5000-5999 | 6 |
| 10000-10999 | 11 |

## Common Operations

### Add XP (Compensation)
```bash
curl -X PATCH https://api/admin/users/user-123/xp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"delta": 500, "reason": "Server downtime compensation"}'
```

### Remove XP (Exploit)
```bash
curl -X PATCH https://api/admin/users/user-456/xp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"delta": -1000, "reason": "Duplicate quest exploit"}'
```

### Reset to 0
```bash
# First, get current XP, then adjust
curl -X PATCH https://api/admin/users/user-789/xp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"delta": -5000, "reason": "Account reset"}'
```

## Error Codes

| Code | Cause | Fix |
|------|-------|-----|
| 200 | Success | All good |
| 400 | XP would go negative | Reduce delta amount |
| 404 | User not found | Check user ID |
| 403 | Not ADMIN role | Check permissions |

## What Gets Updated

✅ User XP value  
✅ User level (recalculated)  
✅ Leaderboard ranking  
✅ Audit logs  
✅ Notifications (if level changed)  

## Validation Rules

- XP cannot go below 0
- Reason cannot be empty
- Reason max 500 characters
- Delta range: -999999 to +999999
- User must exist

## Features

- ✅ Positive and negative adjustments
- ✅ Automatic level recalculation
- ✅ Level-up/level-down notifications
- ✅ Leaderboard updates
- ✅ Complete audit trail
- ✅ Zero validation

## Integration Points

| Component | Action |
|-----------|--------|
| XpService | Calculates levels consistently |
| LeaderboardService | Updates rankings |
| QueueService | Queues level notifications |
| AuditLogService | Logs all adjustments |

## Permissions

**Required Role:** ADMIN

## Test

```bash
npm run test -- admin-xp-adjustment.spec.ts
```

## File References

- **API:** `/src/admin/controllers/admin.controller.ts` - PATCH endpoint
- **Logic:** `/src/admin/services/admin.service.ts` - adjustUserXp()
- **DTO:** `/src/admin/dto/adjust-user-xp.dto.ts`
- **Tests:** `/src/admin/services/tests/admin-xp-adjustment.spec.ts`
- **Docs:** `/XP_CORRECTION_SYSTEM.md`

## Audit Log Query

```sql
SELECT * FROM audit_logs 
WHERE action = 'user.xp.adjusted' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Notifications Sent

When `newLevel > oldLevel`:
- `LEVEL_UP` event queued
- Includes: userId, oldLevel, newLevel, currentXp, adminAdjustment flag

When `newLevel < oldLevel`:
- `LEVEL_DOWN` event queued
- Includes: userId, oldLevel, newLevel, currentXp, adminAdjustment flag

When `oldLevel == newLevel`:
- No notification sent
- Leaderboard still updated if delta ≠ 0
