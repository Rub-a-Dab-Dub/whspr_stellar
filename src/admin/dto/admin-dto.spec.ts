import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRole } from '../../roles/entities/role.entity';
import { RoomType } from '../../room/entities/room.entity';
import {
  LeaderboardCategory,
  LeaderboardPeriod,
} from '../../leaderboard/leaderboard.interface';
import { AuditEventType, AuditOutcome } from '../entities/audit-log.entity';

import { AddIpWhitelistDto } from './add-ip-whitelist.dto';
import {
  AdminAuthResponseDto,
  AdminAuthUserDto,
} from './admin-auth-response.dto';
import { AdminLeaderboardQueryDto } from './admin-leaderboard-query.dto';
import { AdminResetPasswordDto } from './admin-reset-password.dto';
import { BanUserDto } from './ban-user.dto';
import { BulkActionDto, BulkActionType } from './bulk-action.dto';
import { ChangeAdminRoleDto } from './change-admin-role.dto';
import { DateRangeFilterDto } from './date-range-filter.dto';
import { DeactivateAdminDto } from './deactivate-admin.dto';
import { DeleteUserDto } from './delete-user.dto';
import { GetAuditLogsDto } from './get-audit-logs.dto';
import {
  GetOverviewAnalyticsDto,
  AnalyticsPeriod,
} from './get-overview-analytics.dto';
import {
  GetRevenueAnalyticsDto,
  RevenuePeriod,
} from './get-revenue-analytics.dto';
import { GetRoomDetailsDto } from './get-room-details.dto';
import { GetRoomsDto, RoomFilterStatus } from './get-rooms.dto';
import { GetUsersDto, UserFilterStatus } from './get-users.dto';
import { ImpersonateUserDto } from './impersonate-user.dto';
import { InviteAdminDto } from './invite-admin.dto';
import { PaginatedResponseDto } from './paginated-response.dto';
import { PaginationQueryDto, SortOrder } from './pagination-query.dto';
import { ResetLeaderboardDto } from './reset-leaderboard.dto';
import { SetPinnedDto } from './set-pinned.dto';
import { SuspendUserDto } from './suspend-user.dto';
import { UpdateConfigDto } from './update-config.dto';

describe('Admin DTOs', () => {
  it('validates AddIpWhitelistDto', async () => {
    const good = plainToInstance(AddIpWhitelistDto, {
      ipCidr: '192.168.1.0/24',
      description: 'Office range',
    });
    const bad = plainToInstance(AddIpWhitelistDto, {
      ipCidr: 'invalid',
      description: '',
    });

    expect((await validate(good)).length).toBe(0);
    expect((await validate(bad)).length).toBeGreaterThan(0);
  });

  it('validates core admin action DTOs', async () => {
    const invite = plainToInstance(InviteAdminDto, {
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    });
    const changeRole = plainToInstance(ChangeAdminRoleDto, {
      role: UserRole.MODERATOR,
      reason: 'Promoting for moderation queue',
    });
    const deactivate = plainToInstance(DeactivateAdminDto, {
      reason: 'Security review',
    });

    expect((await validate(invite)).length).toBe(0);
    expect((await validate(changeRole)).length).toBe(0);
    expect((await validate(deactivate)).length).toBe(0);
  });

  it('validates user-management DTOs', async () => {
    const ban = plainToInstance(BanUserDto, { reason: 'Spam' });
    const suspend = plainToInstance(SuspendUserDto, {
      suspendedUntil: '2030-01-01T00:00:00Z',
      reason: 'Repeated abuse',
    });
    const deleteDto = plainToInstance(DeleteUserDto, {
      reason: 'GDPR deletion',
      confirmEmail: 'admin@example.com',
    });
    const impersonate = plainToInstance(ImpersonateUserDto, {
      userId: 'user-1',
    });
    const resetPwd = plainToInstance(AdminResetPasswordDto, {
      userId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect((await validate(ban)).length).toBe(0);
    expect((await validate(suspend)).length).toBe(0);
    expect((await validate(deleteDto)).length).toBe(0);
    expect((await validate(impersonate)).length).toBe(0);
    expect((await validate(resetPwd)).length).toBe(0);
  });

  it('validates bulk/analytics/query DTOs and defaults', async () => {
    const bulk = plainToInstance(BulkActionDto, {
      userIds: ['u1', 'u2'],
      action: BulkActionType.BAN,
      reason: 'Bulk moderation',
    });
    const users = plainToInstance(GetUsersDto, {
      status: UserFilterStatus.BANNED,
      page: '2',
      limit: '25',
      sortOrder: 'DESC',
    });
    const rooms = plainToInstance(GetRoomsDto, {
      type: RoomType.PRIVATE,
      status: RoomFilterStatus.ACTIVE,
      page: '1',
    });
    const roomDetails = plainToInstance(GetRoomDetailsDto, { limit: '10' });
    const revenue = plainToInstance(GetRevenueAnalyticsDto, {
      period: RevenuePeriod.MONTH,
    });
    const overview = plainToInstance(GetOverviewAnalyticsDto, {
      period: AnalyticsPeriod.WEEK,
    });
    const auditLogs = plainToInstance(GetAuditLogsDto, {
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      page: '1',
      limit: '50',
    });
    const leaderboard = plainToInstance(AdminLeaderboardQueryDto, {
      period: LeaderboardPeriod.WEEKLY,
      page: '1',
      limit: '20',
    });
    const dateRange = plainToInstance(DateRangeFilterDto, {
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-12-31T00:00:00.000Z',
    });

    expect((await validate(bulk)).length).toBe(0);
    expect((await validate(users)).length).toBe(0);
    expect((await validate(rooms)).length).toBe(0);
    expect((await validate(roomDetails)).length).toBe(0);
    expect((await validate(revenue)).length).toBe(0);
    expect((await validate(overview)).length).toBe(0);
    expect((await validate(auditLogs)).length).toBe(0);
    expect((await validate(leaderboard)).length).toBe(0);
    expect((await validate(dateRange)).length).toBe(0);

    expect(users.page).toBe(2);
    expect(users.limit).toBe(25);
    expect(roomDetails.limit).toBe(10);
  });

  it('validates pagination/pinned/leaderboard reset/config DTOs', async () => {
    const pagination = plainToInstance(PaginationQueryDto, {
      page: '3',
      limit: '30',
      sortOrder: SortOrder.ASC,
    });
    const setPinned = plainToInstance(SetPinnedDto, {
      userId: 'u1',
      category: LeaderboardCategory.TIPS_RECEIVED,
      period: LeaderboardPeriod.ALL_TIME,
      isPinned: true,
    });
    const reset = plainToInstance(ResetLeaderboardDto, {
      reason: 'Monthly refresh',
      snapshotBeforeReset: true,
    });
    const updateConfig = plainToInstance(UpdateConfigDto, {
      value: 'enabled',
      reason: 'Rollout feature flag',
    });

    expect((await validate(pagination)).length).toBe(0);
    expect((await validate(setPinned)).length).toBe(0);
    expect((await validate(reset)).length).toBe(0);
    expect((await validate(updateConfig)).length).toBe(0);
  });

  it('covers response DTO shapes', () => {
    const user: AdminAuthUserDto = { id: '1', email: 'admin@example.com' };
    const authResp: AdminAuthResponseDto = {
      accessToken: 'access',
      refreshToken: 'refresh',
      user,
    };

    const paginated: PaginatedResponseDto<string> = {
      data: ['x'],
      total: 1,
      page: 1,
      limit: 10,
    };

    expect(authResp.user.email).toBe('admin@example.com');
    expect(paginated.data[0]).toBe('x');
  });
});
