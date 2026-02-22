# XP Correction System - Implementation Summary

## Overview

The XP Correction System is a complete administrative feature for adjusting user XP to handle edge cases such as exploit mitigation, compensation, and contest rewards.

## Architecture

### Layered Architecture

```
Controller Layer
    ↓
DTO Validation
    ↓
Service Layer
    ↓
Repository Layer
    ↓
Database
```

### Components

#### 1. DTO Layer (`src/admin/dto/adjust-user-xp.dto.ts`)
```typescript
export class AdjustUserXpDto {
  @IsNumber()
  @Min(-999999)
  @Max(999999)
  delta: number; // XP change amount (positive or negative)

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string; // Explanation for adjustment
}
```

**Validation Rules:**
- delta: Integer between -999,999 and +999,999
- reason: Non-empty string, max 500 characters

#### 2. Controller Layer (`src/admin/controllers/admin.controller.ts`)
```typescript
@Patch('users/:id/xp')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Adjust user XP...' })
@ApiResponse({ status: 200, description: 'XP adjusted successfully' })
@ApiResponse({ status: 400, description: 'Invalid XP adjustment' })
@ApiResponse({ status: 404, description: 'User not found' })
async adjustUserXp(
  @Param('id') userId: string,
  @Body() adjustXpDto: AdjustUserXpDto,
  @CurrentUser() currentUser: any,
  @Req() req: Request,
) {
  return await this.adminService.adjustUserXp(
    userId,
    adjustXpDto,
    currentUser.userId,
    req,
  );
}
```

**Route Guards:**
- `@UseGuards(JwtAuthGuard, RoleGuard)` - Enforces ADMIN role
- Role validation happens before method execution

#### 3. Service Layer (`src/admin/services/admin.service.ts`)

The `adjustUserXp()` method implements the core business logic:

```typescript
async adjustUserXp(
  userId: string,
  adjustXpDto: AdjustUserXpDto,
  adminId: string,
  req: Request,
): Promise<AdjustXpResponse>
```

**Process Flow:**

1. **User Validation**
   ```typescript
   const user = await this.userRepository.findOne({ where: { id: userId } });
   if (!user) {
     throw new NotFoundException(`User with ID ${userId} not found`);
   }
   ```

2. **XP Calculation**
   ```typescript
   const previousXp = user.currentXp;
   const newXp = previousXp + delta;
   
   // Validate non-negative
   if (newXp < 0) {
     throw new BadRequestException(...);
   }
   ```

3. **Level Calculation** (uses XpService)
   ```typescript
   const oldLevel = this.xpService.calculateLevel(previousXp);
   const newLevel = this.xpService.calculateLevel(newXp);
   const levelChanged = newLevel !== oldLevel;
   ```

4. **Update User**
   ```typescript
   user.currentXp = newXp;
   user.level = newLevel;
   await this.userRepository.save(user);
   ```

5. **Update Leaderboard**
   ```typescript
   if (delta !== 0) {
     await this.leaderboardService.updateLeaderboard({
       userId: user.id,
       username: user.username,
       category: LeaderboardCategory.XP,
       scoreIncrement: delta,
     });
   }
   ```

6. **Queue Notifications**
   ```typescript
   if (levelChanged) {
     if (newLevel > oldLevel) {
       await this.notificationsQueue.add('send-notification', {
         type: 'LEVEL_UP',
         userId: user.id,
         oldLevel,
         newLevel,
         adminAdjustment: true,
         reason,
       }, { delay: 1000 });
     } else {
       // LEVEL_DOWN case
     }
   }
   ```

7. **Audit Logging**
   ```typescript
   await this.auditLogService.log({
     adminId,
     action: AuditAction.USER_XP_ADJUSTED,
     resourceType: 'USER',
     resourceId: userId,
     details: reason,
     changes: { previousXp, newXp, delta, oldLevel, newLevel },
     severity: AuditSeverity.MEDIUM,
     outcome: AuditOutcome.SUCCESS,
     ipAddress: req.ip,
     userAgent: req.get('user-agent'),
   });
   ```

#### 4. Audit Entity (`src/admin/entities/audit-log.entity.ts`)

Added new audit action:
```typescript
export enum AuditAction {
  // ... existing actions ...
  USER_XP_ADJUSTED = 'user.xp.adjusted',
  // ... other actions ...
}
```

## Key Design Decisions

### 1. Delta-Based Adjustment
**Decision:** Use signed delta instead of absolute values
**Rationale:** 
- Single parameter for all adjustment types (add/remove)
- Intuitive: +1000 = add XP, -500 = remove XP
- Matches common REST patterns

### 2. Negative XP Prevention
**Decision:** Validate XP ≥ 0 before saving
**Rationale:**
- Level 1 requires 0 XP minimum
- Prevents data inconsistency
- Early validation prevents database errors

### 3. Level Calculation Consistency
**Decision:** Use same `calculateLevel()` formula as XpService
**Rationale:**
- Single source of truth for level calculation
- Changes to XP formula automatically propagate
- Eliminates level calculation drift

### 4. Separate Notification Events
**Decision:** Queue both LEVEL_UP and LEVEL_DOWN events
**Rationale:**
- Allows custom UI handling for each direction
- Future stats tracking of level changes
- Backward compatible with existing LEVEL_UP

### 5. Audit Logging Integration
**Decision:** Log adjustments with full metadata in single transaction
**Rationale:**
- Complete compliance trail
- Debugging aid if issues arise
- Admin accountability

### 6. Leaderboard Updates
**Decision:** Update leaderboard synchronously with actual delta
**Rationale:**
- Real-time ranking accuracy
- Delta may differ from absolute XP change
- Maintains leaderboard consistency

## Data Flow Diagram

```
┌─────────────────────────────────────┐
│   PATCH /admin/users/:id/xp         │
│  {delta: 1000, reason: "Reward"}    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Controller Receives Request       │
│   - Validates DTO                    │
│   - Extracts admin ID & request     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   AdminService.adjustUserXp()       │
│   - Fetch user (DB)                 │
│   - Calculate new XP                │
│   - Validate XP >= 0                │
│   - Calculate levels (XpService)    │
│   - Update user (DB)                │
└────────────┬────────────────────────┘
             │
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
[Leaderboard] [Notifications] [AuditLog]
    │        │        │
    └────────┼────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Return Response                   │
│   - success: true                   │
│   - user: updated user object       │
│   - metadata: XP, levels, etc       │
└─────────────────────────────────────┘
```

## Integration with Existing Systems

### XpService Integration
- Uses `xpService.calculateLevel(xp: number): number`
- Formula: `Math.floor(xp / 1000) + 1`
- Located at: `src/users/services/xp.service.ts`

### LeaderboardService Integration
- Calls `leaderboardService.updateLeaderboard(...)`
- Updates: `LeaderboardCategory.XP`
- Score increment: actual delta value
- Located at: `src/leaderboard/leaderboard.service.ts`

### QueueService Integration
- Queues via: `notificationsQueue.add('send-notification', ...)`
- Event types: `LEVEL_UP`, `LEVEL_DOWN`
- Delay: 1000ms for async processing
- Located via: `@InjectQueue(QUEUE_NAMES.NOTIFICATIONS)`

### AuditLogService Integration
- Called: `auditLogService.log(...)`
- Action: `AuditAction.USER_XP_ADJUSTED`
- Severity: `AuditSeverity.MEDIUM`
- Located at: `src/admin/services/audit-log.service.ts`

## Database Schema

### User Entity Changes
None required - uses existing fields:
- `currentXp: number` - Total accumulated XP
- `level: number` - Current level derived from XP
- `updatedAt: timestamp` - Automatically updated

### Audit Log Entry
New entry created with:
- `action: 'user.xp.adjusted'`
- `resourceType: 'USER'`
- `resourceId: userId`
- `details: reason`
- `changes: { previousXp, newXp, delta, oldLevel, newLevel }`
- `adminId: adminId`
- `ipAddress: req.ip`
- `userAgent: req.get('user-agent')`

## Error Handling Strategy

### 404 Not Found
```typescript
if (!user) {
  throw new NotFoundException(`User with ID ${userId} not found`);
}
```

### 400 Bad Request (XP Validation)
```typescript
if (newXp < 0) {
  throw new BadRequestException(
    `XP adjustment would result in negative XP...`
  );
}
```

### 400 Bad Request (DTO Validation)
- Handled by NestJS class-validator
- Non-empty reason
- delta within range
- Proper types

### 403 Forbidden
- Handled by RoleGuard middleware
- Only ADMIN role allowed

## Testing Strategy

### Unit Tests (`admin-xp-adjustment.spec.ts`)

**Coverage Areas:**

1. **Successful Operations**
   - Increase XP with level up
   - Decrease XP with level down
   - Edge case: XP → 0

2. **Validation**
   - Block negative XP
   - User not found
   - DTO validation (handled by NestJS)

3. **Event Emission**
   - LEVEL_UP notifications
   - LEVEL_DOWN notifications
   - No notification when level unchanged

4. **Leaderboard**
   - Update with delta
   - Skip when delta = 0

5. **Audit Logging**
   - Proper metadata
   - Admin tracking

6. **Edge Cases**
   - Large positive adjustments
   - Large negative adjustments
   - Zero delta
   - XP exactly at boundaries

**Test Command:**
```bash
npm run test -- admin-xp-adjustment.spec.ts
```

### E2E Tests (Future)

Recommended scenarios:
- Full flow: request → validation → update → response
- Multiple users in sequence
- Concurrent adjustments
- Leaderboard ranking updates
- Notification delivery

## Deployment Checklist

- [ ] Code review completed
- [ ] Unit tests passing
- [ ] No database migrations needed
- [ ] Audit enum updated
- [ ] Documentation completed
- [ ] API documentation in Swagger
- [ ] Error messages tested
- [ ] Role-based access verified
- [ ] Audit logging verified
- [ ] Monitoring alerts configured
- [ ] Staff training (if needed)

## Files Modified/Created

### New Files
1. `src/admin/dto/adjust-user-xp.dto.ts` - Request DTO
2. `src/admin/services/tests/admin-xp-adjustment.spec.ts` - Unit tests
3. `XP_CORRECTION_SYSTEM.md` - Full documentation
4. `XP_CORRECTION_QUICK_REF.md` - Quick reference guide
5. `XP_CORRECTION_IMPLEMENTATION.md` - This file

### Modified Files
1. `src/admin/controllers/admin.controller.ts`
   - Added import for AdjustUserXpDto
   - Added PATCH /admin/users/:id/xp endpoint

2. `src/admin/services/admin.service.ts`
   - Added import for AdjustUserXpDto and XpService
   - Added XpService injection in constructor
   - Added `adjustUserXp()` method

3. `src/admin/entities/audit-log.entity.ts`
   - Added `USER_XP_ADJUSTED = 'user.xp.adjusted'` to AuditAction enum

## Security Considerations

### Authentication
- Requires valid JWT bearer token
- Token validates admin user ID

### Authorization
- Role-based access control: ADMIN only
- Future: Can add permission-based granularity

### Audit Trail
- All adjustments logged with admin ID
- Includes IP address and user agent
- Immutable audit logs

### Data Validation
- DTO validation before controller
- Type checking for delta and reason
- No SQL injection possible (TypeORM)

### Rate Limiting
- Endpoint subject to general API rate limits
- No specific XP adjustment throttling (can be added)

## Performance Considerations

### Database Operations
- 1 SELECT (fetch user)
- 1 UPDATE (save user)
- 1 INSERT (audit log)
- Total: 3 database hits per request

### Async Operations
- Leaderboard update: awaited
- Notifications: queued (non-blocking)
- Audit logging: awaited

### Optimization Opportunities
- Batch user updates (future)
- Caching level calculations (likely not needed)
- Notification queue batching (already done)

## Monitoring & Alerts

### Recommended Metrics
- Requests/minute to endpoint
- Average response time
- Error rate (400, 404, 403)
- Large adjustment detection (>10k XP)

### Log Entries to Monitor
```
INFO: XP adjusted for user ${userId}: ${previousXp} → ${newXp}...
ERROR: Failed to adjust XP...
```

## Version History

### v1.0 (Current)
- Initial implementation
- Single user adjustment
- Delta-based system
- Level-dependent notifications
- Audit logging
- Leaderboard integration

## Future Enhancements

1. **Batch Operations**
   - PATCH /admin/users/batch/xp
   - Multi-user adjustments in single request

2. **Approval Workflow**
   - Large adjustments require approval
   - Audit trail of approval chain

3. **Scheduled Adjustments**
   - Queue future XP corrections
   - Timed compensation distribution

4. **XP Audit History**
   - Dedicated XpAdjustment entity
   - Track all admin corrections
   - Comparison reports

5. **Advanced Notifications**
   - Custom notification templates
   - Bulk notification batching
   - Localization support

## Support & Troubleshooting

### Issue: "User not found"
- Verify user ID exists
- Check user ID format (UUID)

### Issue: "XP would go negative"
- Reduce delta magnitude
- Check current user XP first

### Issue: "Insufficient permissions"
- Verify user has ADMIN role
- Check JWT token validity

### Issue: Leaderboard not updating
- Check LeaderboardService status
- Verify user exists in leaderboard
- Check for errors in logs

## References

- XpService: `src/users/services/xp.service.ts`
- LeaderboardService: `src/leaderboard/leaderboard.service.ts`
- AuditLogService: `src/admin/services/audit-log.service.ts`
- NestJS Docs: https://docs.nestjs.com
