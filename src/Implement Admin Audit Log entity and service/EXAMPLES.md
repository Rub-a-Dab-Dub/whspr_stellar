# Admin Audit Log Examples

This file demonstrates various use cases and examples for the Admin Audit Log Service.

## Example 1: User Ban Action

```typescript
import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  AdminAuditLogService,
  AdminAuditLogAction,
  AuditLogTargetType,
} from '@/admin-audit-log';

@Controller('admin/users')
export class UserAdminController {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  @Post(':userId/ban')
  async banUser(
    @Param('userId') userId: string,
    @Body() body: { reason: string; durationDays: number },
    @Req() request: Request,
  ) {
    const admin = request.user; // Assumes auth middleware sets user
    const ipAddress = request.ip;

    // Perform the ban
    // await this.userService.banUser(userId, ...);

    // Log to audit trail
    this.auditLogService.log({
      adminId: admin.id,
      adminEmail: admin.email,
      action: AdminAuditLogAction.BAN_USER,
      targetType: AuditLogTargetType.USER,
      targetId: userId,
      ipAddress,
      metadata: {
        reason: body.reason,
        durationDays: body.durationDays,
        banUntil: new Date(
          Date.now() + body.durationDays * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return { success: true };
  }
}
```

## Example 2: Configuration Change Audit

```typescript
import { Controller, Patch, Body, Req } from '@nestjs/common';
import {
  AdminAuditLogService,
  AdminAuditLogAction,
  AuditLogTargetType,
} from '@/admin-audit-log';

@Controller('admin/config')
export class ConfigAdminController {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  @Patch('settings')
  async updateSettings(
    @Body() newSettings: Record<string, any>,
    @Req() request: Request,
  ) {
    const admin = request.user;
    const ipAddress = request.ip;

    // Get current settings for before/after comparison
    const oldSettings = await this.getCurrentSettings();

    // Update settings
    await this.saveSettings(newSettings);

    // Log the change with full context
    this.auditLogService.log({
      adminId: admin.id,
      adminEmail: admin.email,
      action: AdminAuditLogAction.CONFIG_CHANGE,
      targetType: AuditLogTargetType.PLATFORM,
      ipAddress,
      metadata: {
        changedFields: Object.keys(newSettings),
        before: oldSettings,
        after: newSettings,
        timestamp: new Date(),
      },
    });

    return { success: true, changes: newSettings };
  }

  private async getCurrentSettings(): Promise<Record<string, any>> {
    // Implementation
    return {};
  }

  private async saveSettings(settings: Record<string, any>): Promise<void> {
    // Implementation
  }
}
```

## Example 3: Querying Audit Logs

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import {
  AdminAuditLogService,
  AdminAuditLogFilterDto,
  AdminAuditLogAction,
  AuditLogTargetType,
} from '@/admin-audit-log';

@Controller('admin/audit-logs')
export class AuditLogQueryController {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  // Get all audit logs with filtering
  @Get()
  async getAllLogs(
    @Query('adminId') adminId?: string,
    @Query('action') action?: AdminAuditLogAction,
    @Query('targetType') targetType?: AuditLogTargetType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.auditLogService.findAll({
      adminId,
      action,
      targetType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
    });
  }

  // Get audit logs for a specific admin
  @Get('admin/:adminId')
  async getAdminLogs(
    @Param('adminId') adminId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const offset = (page - 1) * limit;
    return this.auditLogService.findByAdminId(adminId, limit, offset);
  }

  // Get recent activity (last 7 days)
  @Get('recent-activity')
  async getRecentActivity(@Query('limit') limit: number = 100) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.auditLogService.findAll({
      startDate: sevenDaysAgo,
      page: 1,
      limit,
    });
  }

  // Get high-risk actions
  @Get('high-risk-actions')
  async getHighRiskActions(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const highRiskActions = [
      AdminAuditLogAction.DELETE_ROOM,
      AdminAuditLogAction.BAN_USER,
      AdminAuditLogAction.WITHDRAW,
      AdminAuditLogAction.CONFIG_CHANGE,
    ];

    const allLogs = [];

    for (const action of highRiskActions) {
      const logs = await this.auditLogService.findAll({
        action,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: 1000,
      });
      allLogs.push(...logs.data);
    }

    return {
      total: allLogs.length,
      logs: allLogs.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    };
  }

  // Get specific log entry
  @Get(':logId')
  async getLogEntry(@Param('logId') logId: string) {
    return this.auditLogService.findById(logId);
  }

  private getCurrentSettings(): Promise<Record<string, any>> {
    // Implementation
    return Promise.resolve({});
  }

  private saveSettings(settings: Record<string, any>): Promise<void> {
    // Implementation
    return Promise.resolve();
  }
}
```

## Example 4: Batch Operations with Audit Trail

```typescript
import { Controller, Post, Body, Req } from '@nestjs/common';
import { Admin AuditLogService, AdminAuditLogAction, AuditLogTargetType } from '@/admin-audit-log';

@Controller('admin/bulk-actions')
export class BulkActionController {
  constructor(
    private readonly auditLogService: AdminAuditLogService,
  ) {}

  @Post('ban-users')
  async banMultipleUsers(
    @Body() body: { userIds: string[]; reason: string },
    @Req() request: Request,
  ) {
    const admin = request.user;
    const ipAddress = request.ip;

    // Perform bulk ban operation
    const results = await this.performBulkBan(body.userIds);

    // Log all actions in batch
    const auditLogs = body.userIds.map(userId => ({
      adminId: admin.id,
      adminEmail: admin.email,
      action: AdminAuditLogAction.BAN_USER,
      targetType: AuditLogTargetType.USER,
      targetId: userId,
      ipAddress,
      metadata: {
        reason: body.reason,
        batchOperation: true,
        batchSize: body.userIds.length,
      },
    }));

    // Non-blocking batch logging
    this.auditLogService.logBatch(auditLogs);

    return {
      success: true,
      processed: results.length,
      banned: body.userIds,
    };
  }

  private async performBulkBan(userIds: string[]): Promise<any[]> {
    // Implementation
    return [];
  }
}
```

## Example 5: Advanced Queries

```typescript
// Get login history for an admin
const loginHistory = await auditLogService.findByAdminId(adminId, 50, 0);

// Count specific action types
const banCount = await auditLogService.countByAction(
  AdminAuditLogAction.BAN_USER,
);
const deleteCount = await auditLogService.countByAction(
  AdminAuditLogAction.DELETE_ROOM,
);

// Get distinct admins
const adminIds = await auditLogService.getAdminIds();

// Complex filtering - get all deletions from last 30 days by specific admin
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const deletionLogs = await auditLogService.findAll({
  adminId: specificAdminId,
  action: AdminAuditLogAction.DELETE_ROOM,
  startDate: thirtyDaysAgo,
  page: 1,
  limit: 100,
});
```

## Example 6: Audit Log Reporting

```typescript
import { Injectable } from '@nestjs/common';
import {
  AdminAuditLogService,
  AdminAuditLogAction,
  AuditLogTargetType,
} from '@/admin-audit-log';

@Injectable()
export class AuditReportService {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  async generateComplianceReport(startDate: Date, endDate: Date) {
    // Get all sensitive actions within date range
    const sensitiveActions = [
      AdminAuditLogAction.BAN_USER,
      AdminAuditLogAction.DELETE_ROOM,
      AdminAuditLogAction.CONFIG_CHANGE,
      AdminAuditLogAction.WITHDRAW,
    ];

    const report = {
      period: { startDate, endDate },
      summary: {},
      actions: [],
    };

    for (const action of sensitiveActions) {
      const logs = await this.auditLogService.findAll({
        action,
        startDate,
        endDate,
        limit: 10000,
      });

      report.summary[action] = logs.data.length;
      report.actions.push(...logs.data);
    }

    return report;
  }

  async generateAdminActivityReport(adminId: string, monthsBack: number = 3) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const logs = await this.auditLogService.findByAdminId(adminId, 10000, 0);

    const filtered = logs.data.filter((log) => log.createdAt >= startDate);

    const actionCounts = {};
    const targetTypeCounts = {};

    for (const log of filtered) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      targetTypeCounts[log.targetType] =
        (targetTypeCounts[log.targetType] || 0) + 1;
    }

    return {
      admin: adminId,
      period: { months: monthsBack },
      totalActions: filtered.length,
      actionBreakdown: actionCounts,
      targetBreakdown: targetTypeCounts,
      recentActions: filtered.slice(0, 50),
    };
  }

  async detectAnomalies() {
    // Get all admins
    const adminIds = await this.auditLogService.getAdminIds();

    const anomalies = [];

    for (const adminId of adminIds) {
      const lastDay = new Date();
      lastDay.setDate(lastDay.getDate() - 1);

      const recentLogs = await this.auditLogService.findAll({
        adminId,
        startDate: lastDay,
        limit: 10000,
      });

      // Detect unusual patterns
      if (recentLogs.data.length > 1000) {
        anomalies.push({
          type: 'EXCESSIVE_ACTIVITY',
          adminId,
          count: recentLogs.data.length,
          message: `Admin performed ${recentLogs.data.length} actions in 24 hours`,
        });
      }

      // Check for suspicious action combinations
      const deletions = recentLogs.data.filter(
        (log) => log.action === AdminAuditLogAction.DELETE_ROOM,
      ).length;

      if (deletions > 50) {
        anomalies.push({
          type: 'BULK_DELETIONS',
          adminId,
          count: deletions,
          message: `Admin deleted ${deletions} rooms in 24 hours`,
        });
      }
    }

    return anomalies;
  }
}
```

## Example 7: Integration with Logging Service

```typescript
import { Injectable, Logger } from '@nestjs/common';
import {
  AdminAuditLogService,
  AdminAuditLogAction,
  AuditLogTargetType,
} from '@/admin-audit-log';

@Injectable()
export class AdminActionService {
  private readonly logger = new Logger(AdminActionService.name);

  constructor(private readonly auditLogService: AdminAuditLogService) {}

  async performCriticalAction(actionData: any, admin: any, ipAddress: string) {
    const startTime = Date.now();

    try {
      // Perform the action
      const result = await this.executeAction(actionData);

      // Log success with duration
      this.auditLogService.log({
        adminId: admin.id,
        adminEmail: admin.email,
        action: AdminAuditLogAction.SYSTEM_MAINTENANCE,
        targetType: AuditLogTargetType.SYSTEM,
        ipAddress,
        metadata: {
          actionData,
          result,
          duration: Date.now() - startTime,
          status: 'SUCCESS',
        },
      });

      this.logger.log(
        `Critical action completed: ${actionData.type} (${Date.now() - startTime}ms)`,
      );

      return result;
    } catch (error) {
      // Log failure
      this.auditLogService.log({
        adminId: admin.id,
        adminEmail: admin.email,
        action: AdminAuditLogAction.SECURITY_INCIDENT,
        targetType: AuditLogTargetType.SYSTEM,
        ipAddress,
        metadata: {
          actionData,
          error: error.message,
          duration: Date.now() - startTime,
          status: 'FAILED',
          stack: error.stack,
        },
      });

      this.logger.error(
        `Critical action failed: ${actionData.type}`,
        error.stack,
      );

      throw error;
    }
  }

  private async executeAction(actionData: any): Promise<any> {
    // Implementation
    return {};
  }
}
```
