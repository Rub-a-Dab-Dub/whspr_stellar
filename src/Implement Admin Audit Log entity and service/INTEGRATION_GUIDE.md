# Admin Audit Log Integration Guide

This guide demonstrates how to integrate the Admin Audit Log Service across your admin modules.

## Basic Integration Example

### 1. User Management Module

```typescript
// user-management/user-management.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLogModule } from '@/admin-audit-log';
import { User } from './entities/user.entity';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AdminAuditLogModule],
  providers: [UserService],
  controllers: [UserController],
})
export class UserManagementModule {}
```

### 2. User Service with Audit Logging

```typescript
// user-management/services/user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AdminAuditLogService,
  AdminAuditLogAction,
  AuditLogTargetType,
} from '@/admin-audit-log';
import { User } from '../entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditLogService: AdminAuditLogService,
  ) {}

  async banUser(
    userId: string,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    reason: string,
    durationDays: number,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Perform the ban
    user.banned = true;
    user.banReason = reason;
    user.banUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    await this.userRepository.save(user);

    // Log the action (non-blocking, fire-and-forget)
    this.auditLogService.log({
      adminId,
      adminEmail,
      action: AdminAuditLogAction.BAN_USER,
      targetType: AuditLogTargetType.USER,
      targetId: userId,
      ipAddress,
      metadata: {
        reason,
        durationDays,
        userEmail: user.email,
        bannedUntil: user.banUntil,
      },
    });
  }

  async deleteUser(
    userId: string,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const userEmail = user.email;

    // Delete the user
    await this.userRepository.remove(user);

    // Log the deletion
    this.auditLogService.log({
      adminId,
      adminEmail,
      action: AdminAuditLogAction.USER_DELETED,
      targetType: AuditLogTargetType.USER,
      targetId: userId,
      ipAddress,
      metadata: {
        userEmail,
        deleteReason: 'Admin initiated deletion',
      },
    });
  }
}
```

### 3. Room Management with Audit Logging

```typescript
// room-management/services/room.service.ts
import { Injectable } from '@nestjs/common';
import {
  AdminAuditLogService,
  AdminAuditLogAction,
  AuditLogTargetType,
} from '@/admin-audit-log';
import { Room } from '../entities/room.entity';

@Injectable()
export class RoomService {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  async deleteRoom(
    roomId: string,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
  ) {
    // Delete the room
    const room = await this.getRoomDetails(roomId);
    await this.performDeletion(roomId);

    // Log the deletion with details
    this.auditLogService.log({
      adminId,
      adminEmail,
      action: AdminAuditLogAction.DELETE_ROOM,
      targetType: AuditLogTargetType.ROOM,
      targetId: roomId,
      ipAddress,
      metadata: {
        roomName: room.name,
        description: room.description,
        userCount: room.userCount,
        deletionReason: 'Admin initiated deletion',
      },
    });
  }

  async closeRoom(
    roomId: string,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    closeReason: string,
  ) {
    const room = await this.getRoomDetails(roomId);

    // Close the room
    room.closed = true;
    room.closeReason = closeReason;
    await this.saveRoom(room);

    // Log the closure
    this.auditLogService.log({
      adminId,
      adminEmail,
      action: AdminAuditLogAction.CLOSE_ROOM,
      targetType: AuditLogTargetType.ROOM,
      targetId: roomId,
      ipAddress,
      metadata: {
        closeReason,
        wasActive: !room.closed,
      },
    });
  }

  private async getRoomDetails(roomId: string): Promise<Room> {
    // Implementation
    return {} as Room;
  }

  private async performDeletion(roomId: string): void {
    // Implementation
  }

  private async saveRoom(room: Room): Promise<void> {
    // Implementation
  }
}
```

### 4. Configuration Management with Audit Logging

```typescript
// config-management/services/config.service.ts
import { Injectable } from '@nestjs/common';
import {
  AdminAuditLogService,
  AdminAuditLogAction,
  AuditLogTargetType,
} from '@/admin-audit-log';

@Injectable()
export class SystemConfigService {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  async updateConfiguration(
    key: string,
    oldValue: any,
    newValue: any,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
  ) {
    // Perform configuration update
    await this.performUpdate(key, newValue);

    // Log the change
    this.auditLogService.log({
      adminId,
      adminEmail,
      action: AdminAuditLogAction.CONFIG_CHANGE,
      targetType: AuditLogTargetType.PLATFORM,
      metadata: {
        key,
        oldValue,
        newValue,
        timestamp: new Date(),
      },
      ipAddress,
    });
  }

  private async performUpdate(key: string, value: any): Promise<void> {
    // Implementation
  }
}
```

## Querying Audit Logs

### In a Controller

```typescript
// audit-log/controllers/audit-log.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import {
  AdminAuditLogService,
  AdminAuditLogFilterDto,
} from '@/admin-audit-log';

@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  @Get()
  async getAuditLogs(@Query() filterQuery: AdminAuditLogFilterDto) {
    const filters = {
      adminId: filterQuery.adminId,
      action: filterQuery.action,
      targetType: filterQuery.targetType,
      startDate: filterQuery.startDate
        ? new Date(filterQuery.startDate)
        : undefined,
      endDate: filterQuery.endDate ? new Date(filterQuery.endDate) : undefined,
      page: parseInt(filterQuery.page?.toString() || '1'),
      limit: parseInt(filterQuery.limit?.toString() || '20'),
    };

    return this.auditLogService.findAll(filters);
  }

  @Get(':adminId/history')
  async getAdminHistory(
    @Param('adminId') adminId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.auditLogService.findByAdminId(
      adminId,
      limit,
      (page - 1) * limit,
    );
  }
}
```

## Best Practices

### 1. Always Capture Context

```typescript
// Good: Capture relevant metadata
this.auditLogService.log({
  adminId,
  adminEmail,
  action: AdminAuditLogAction.BAN_USER,
  targetType: AuditLogTargetType.USER,
  targetId: userId,
  metadata: {
    reason: 'Spam violation',
    duration: 30,
    userEmail: user.email,
    previousStatus: user.status,
  },
  ipAddress,
});

// Bad: No metadata
this.auditLogService.log({
  adminId,
  adminEmail,
  action: AdminAuditLogAction.BAN_USER,
  targetType: AuditLogTargetType.USER,
  targetId: userId,
});
```

### 2. Use Fire-and-Forget to Avoid Blocking

```typescript
// Good: Don't await, let it run in background
this.auditLogService.log({ ... });

// Bad: Unnecessary awaiting
await this.auditLogService.log({ ... });

// Exception: Batch operations
await this.auditLogService.logBatch(auditLogs);
```

### 3. Extract IP Address Early

In NestJS, extract IP from the request:

```typescript
import { Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('admin')
export class AdminController {
  @Post('actions')
  async performAction(@Req() request: Request) {
    const ipAddress = request.ip || request.socket.remoteAddress;

    // Use ipAddress in all audit log calls
    this.auditLogService.log({
      ...ipAddress,
    });
  }
}
```

### 4. Denormalize Email for Integrity

Always include the admin's email at the time of action:

```typescript
// Always capture current admin email
const adminEmail = admin.email; // Get from current user context
this.auditLogService.log({
  adminId,
  adminEmail, // Denormalized for log integrity
  ...
});
```

### 5. Comprehensive Metadata

Store before/after values for sensitive changes:

```typescript
const oldConfig = await this.getConfig();
await this.updateConfig(newSettings);

this.auditLogService.log({
  action: AdminAuditLogAction.CONFIG_CHANGE,
  targetType: AuditLogTargetType.PLATFORM,
  metadata: {
    before: oldConfig,
    after: newSettings,
    changedFields: Object.keys(newSettings),
  },
});
```

## Error Handling

The audit log service is designed to not interfere with admin operations:

```typescript
async deleteUser(userId: string, adminContext: any) {
  // Delete the user
  await this.userRepository.remove(user);

  // Even if audit logging fails, the user is already deleted
  // Errors are logged but not thrown
  this.auditLogService.log({
    adminId: adminContext.id,
    adminEmail: adminContext.email,
    action: AdminAuditLogAction.USER_DELETED,
    targetType: AuditLogTargetType.USER,
    targetId: userId,
  });

  // This call always completes
  return { success: true };
}
```

## Performance Considerations

### Batch Logging

For bulk operations, use batch logging:

```typescript
async banMultipleUsers(userIds: string[], adminId: string, adminEmail: string) {
  const logs = userIds.map(userId => ({
    adminId,
    adminEmail,
    action: AdminAuditLogAction.BAN_USER,
    targetType: AuditLogTargetType.USER,
    targetId: userId,
    metadata: { reason: 'Bulk moderation action' },
  }));

  // Non-blocking batch insert
  this.auditLogService.logBatch(logs);
}
```

### Query Optimization

Always use specific filters to reduce result sets:

```typescript
// Good: Specific filters
const result = await this.auditLogService.findAll({
  adminId: 'specific-admin',
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  page: 1,
  limit: 20,
});

// Bad: No filters, returns all logs
const result = await this.auditLogService.findAll({
  page: 1,
  limit: 20,
});
```

## Compliance Requirements

Ensure these compliance needs are met:

- ✅ **Immutability**: Logs are never updated or deleted
- ✅ **Completeness**: All admin actions must be logged
- ✅ **Context**: Sufficient metadata for compliance review
- ✅ **Timestamp**: All logs have server-side timestamps
- ✅ **Identity**: Admin ID and email recorded
- ✅ **IP Tracking**: Source IP address captured
- ✅ **Retention**: Logs stored long-term for audits
