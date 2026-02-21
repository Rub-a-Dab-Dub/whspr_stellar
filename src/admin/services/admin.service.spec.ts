import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';
import { TransferBalanceService } from '../../transfer/services/transfer-balance.service';
import { RedisService } from '../../redis/redis.service';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { CacheService } from '../../cache/cache.service';
import { AuditAction } from '../entities/audit-log.entity';
import { BulkActionType } from '../dto/bulk-action.dto';
import { RoomFilterStatus } from '../dto/get-rooms.dto';
import { RoomType } from '../../room/entities/room.entity';
import { PaymentStatus } from '../../room/entities/room-payment.entity';
import { ADMIN_STREAM_EVENTS } from '../gateways/admin-event-stream.gateway';
import { RevenuePeriod } from '../dto/get-revenue-analytics.dto';
import { AnalyticsPeriod } from '../dto/get-overview-analytics.dto';

const makeQueryBuilder = () => {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawAndEntities: jest.fn().mockResolvedValue({ raw: [], entities: [] }),
    getCount: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  return qb;
};

describe('AdminService', () => {
  let service: AdminService;

  const userRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    findBy: jest.fn(),
  };

  const auditLogRepository = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const transferRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
  };

  const sessionRepository = {
    find: jest.fn(),
    findBy: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };

  const messageRepository = {
    count: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
  };

  const roomRepository = {
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const roomMemberRepository = {
    count: jest.fn(),
  };

  const roomPaymentRepository = {
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const platformConfigRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const auditLogService: Pick<
    AuditLogService,
    | 'createAuditLog'
    | 'logDataAccess'
    | 'searchAuditLogs'
    | 'exportAuditLogs'
    | 'getDataAccessLogsForUser'
  > = {
    createAuditLog: jest.fn(async (v) => v as any),
    logDataAccess: jest.fn(async (v) => v as any),
    searchAuditLogs: jest.fn(
      async () => ({ logs: [], total: 0, page: 1, limit: 50 }) as any,
    ),
    exportAuditLogs: jest.fn(
      async () => ({ contentType: 'text/csv', data: 'csv' }) as any,
    ),
    getDataAccessLogsForUser: jest.fn(async () => []),
  };

  const transferBalanceService = {
    getBalance: jest.fn(),
  } as unknown as TransferBalanceService;

  const redisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  } as unknown as RedisService;

  const eventEmitter = {
    emit: jest.fn(),
  } as unknown as EventEmitter2;

  const leaderboardService = {
    getTopUsers: jest.fn(async () => []),
    adminResetLeaderboard: jest.fn(async () => ({ reset: true })),
    getHistory: jest.fn(async () => ({ items: [], total: 0 })),
    setPinnedStatus: jest.fn(async () => ({ success: true })),
  } as unknown as LeaderboardService;

  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
  } as unknown as CacheService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AdminService(
      userRepository as any,
      auditLogRepository as any,
      transferRepository as any,
      sessionRepository as any,
      messageRepository as any,
      roomRepository as any,
      roomMemberRepository as any,
      roomPaymentRepository as any,
      platformConfigRepository as any,
      auditLogService as AuditLogService,
      transferBalanceService,
      redisService,
      eventEmitter,
      leaderboardService,
      cacheService,
    );
  });

  it('gets users and logs audit/data-access events', async () => {
    const qb = makeQueryBuilder();
    qb.getManyAndCount.mockResolvedValue([
      [{ id: 'u1', email: 'u@example.com' }],
      1,
    ]);
    userRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getUsers(
      {
        search: 'u@',
        page: 1,
        limit: 10,
      } as any,
      'admin-1',
    );

    expect(result.total).toBe(1);
    expect(result.users).toHaveLength(1);
    expect(qb.andWhere).toHaveBeenCalled();
    expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: AuditAction.USER_VIEWED,
      }),
    );
    expect(auditLogService.logDataAccess).toHaveBeenCalled();
  });

  it('returns user detail and logs data access', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'u1',
      email: 'u@example.com',
      roles: [],
    });

    const user = await service.getUserDetail('u1', 'admin-1');

    expect(user.id).toBe('u1');
    expect(auditLogService.logDataAccess).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'user', resourceId: 'u1' }),
    );
  });

  it('throws when user detail target does not exist', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.getUserDetail('missing', 'admin-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('bans a user and emits stream event', async () => {
    userRepository.findOne
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'u@example.com',
        isBanned: false,
        roles: [],
      })
      .mockResolvedValueOnce({
        id: 'u1',
        roles: [{ name: 'user' }],
      });
    userRepository.save.mockImplementation(async (u) => u);

    const result = await service.banUser('u1', 'admin-1', { reason: 'abuse' });

    expect(result.isBanned).toBe(true);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      ADMIN_STREAM_EVENTS.USER_BANNED,
      expect.objectContaining({ type: 'user.banned' }),
    );
    expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.USER_BANNED }),
    );
  });

  it('prevents banning admin users', async () => {
    userRepository.findOne
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'admin@example.com',
        isBanned: false,
        roles: [],
      })
      .mockResolvedValueOnce({ id: 'u1', roles: [{ name: 'admin' }] });

    await expect(
      service.banUser('u1', 'admin-1', { reason: 'test' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('unbans a banned user', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'u1',
      email: 'u@example.com',
      isBanned: true,
      bannedAt: new Date(),
    });
    userRepository.save.mockImplementation(async (u) => u);

    const result = await service.unbanUser('u1', 'admin-1');

    expect(result.isBanned).toBe(false);
    expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.USER_UNBANNED }),
    );
  });

  it('throws when unbanning a user that is not banned', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'u1', isBanned: false });

    await expect(service.unbanUser('u1', 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('runs bulk action and reports failed items', async () => {
    userRepository.find.mockResolvedValue([
      {
        id: 'u1',
        email: 'u1@example.com',
        role: 'user',
        isBanned: false,
        roles: [{ name: 'user' }],
      },
      {
        id: 'u2',
        email: 'u2@example.com',
        role: 'admin',
        isBanned: false,
        roles: [{ name: 'admin' }],
      },
    ] as any);
    userRepository.save.mockImplementation(async (u) => u);

    const result = await service.bulkAction(
      {
        userIds: ['u1', 'u2'],
        action: BulkActionType.BAN,
        reason: 'bulk moderation',
      },
      'admin-1',
    );

    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain('Cannot ban admin user');
  });

  it('delegates audit log list/export actions with audit entries', async () => {
    (auditLogService.searchAuditLogs as jest.Mock).mockResolvedValue({
      logs: [{ id: 'log-1' }],
      total: 1,
      page: 1,
      limit: 50,
    });
    (auditLogService.exportAuditLogs as jest.Mock).mockResolvedValue({
      contentType: 'application/json',
      data: [{ id: 'log-1' }],
    });

    const logs = await service.getAuditLogs({ page: 1, limit: 10 }, 'admin-1');
    const exported = await service.exportAuditLogs({}, 'json', 'admin-1');

    expect(logs.total).toBe(1);
    expect(exported.contentType).toBe('application/json');
    expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.AUDIT_LOG_VIEWED }),
    );
    expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.AUDIT_LOG_EXPORTED }),
    );
    expect(auditLogService.logDataAccess).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'audit_logs' }),
    );
  });

  it('returns leaderboard metadata and delegates category queries', async () => {
    const types = await service.getLeaderboardTypes();
    const entries = await service.getLeaderboardEntries(
      'xp' as any,
      {
        period: 'daily',
        page: 1,
        limit: 20,
      } as any,
    );

    expect(types).toContain('xp');
    expect(entries).toEqual([]);
    expect(leaderboardService.getTopUsers).toHaveBeenCalled();
  });

  it('maps room listing with computed status, message count and fees', async () => {
    const qb = makeQueryBuilder();
    qb.getManyAndCount.mockResolvedValue([
      [
        {
          id: 'room-1',
          name: 'General',
          roomType: RoomType.PRIVATE,
          isActive: true,
          isDeleted: false,
          isExpired: false,
          warningNotificationSent: false,
          memberCount: 2,
          entryFee: '1.00',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          expiryTimestamp: null,
          owner: { id: 'u1', username: 'owner' },
        },
        {
          id: 'room-2',
          name: 'Flagged',
          roomType: RoomType.PRIVATE,
          isActive: false,
          isDeleted: false,
          isExpired: false,
          warningNotificationSent: true,
          memberCount: 1,
          entryFee: '0.00',
          createdAt: new Date('2025-01-02T00:00:00.000Z'),
          expiryTimestamp: null,
          owner: null,
        },
      ],
      2,
    ]);

    roomRepository.createQueryBuilder.mockReturnValue(qb);
    messageRepository.count.mockResolvedValue(5);

    const paymentQb = makeQueryBuilder();
    paymentQb.getRawOne.mockResolvedValue({ total: '10.50' });
    roomPaymentRepository.createQueryBuilder.mockReturnValue(paymentQb);

    const result = await service.getRooms({
      status: RoomFilterStatus.ACTIVE,
    } as any);

    expect(result.total).toBe(2);
    expect(result.rooms[0].status).toBe(RoomFilterStatus.ACTIVE);
    expect(result.rooms[1].status).toBe(RoomFilterStatus.FLAGGED);
    expect(paymentQb.andWhere).toHaveBeenCalledWith(
      'payment.status = :status',
      {
        status: PaymentStatus.COMPLETED,
      },
    );
  });

  it('suspends and unsuspends regular users', async () => {
    const user = {
      id: 'u1',
      email: 'u@example.com',
      roles: [{ name: 'user' }],
    };
    userRepository.findOne.mockResolvedValue(user);
    userRepository.save.mockImplementation(async (u) => u);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const suspended = await service.suspendUser('u1', 'admin-1', {
      suspendedUntil: future,
      reason: 'policy',
    } as any);
    expect(suspended.suspendedBy).toBe('admin-1');

    userRepository.findOne.mockResolvedValueOnce({
      ...suspended,
      suspendedUntil: new Date(Date.now() + 10000),
    });
    const unsuspended = await service.unsuspendUser('u1', 'admin-1');
    expect(unsuspended.suspendedUntil).toBeNull();
  });

  it('rejects invalid suspension date', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'u1',
      roles: [{ name: 'user' }],
    });

    await expect(
      service.suspendUser('u1', 'admin-1', {
        suspendedUntil: new Date(Date.now() - 1000).toISOString(),
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('verifies and unverifies users', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'u1' });
    userRepository.save.mockImplementation(async (u) => u);

    const verified = await service.verifyUser('u1', 'admin-1');
    expect(verified.isVerified).toBe(true);
    const unverified = await service.unverifyUser('u1', 'admin-1');
    expect(unverified.isVerified).toBe(false);
  });

  it('returns user statistics with role counts', async () => {
    userRepository.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(4);
    const suspendedQb = makeQueryBuilder();
    suspendedQb.getCount.mockResolvedValueOnce(3);
    const recentQb = makeQueryBuilder();
    recentQb.getCount.mockResolvedValueOnce(5);
    userRepository.createQueryBuilder
      .mockReturnValueOnce(suspendedQb)
      .mockReturnValueOnce(recentQb);
    userRepository.find.mockResolvedValue([
      { roles: [{ name: 'admin' }] },
      { roles: [{ name: 'user' }] },
      { roles: [] },
    ] as any);

    const stats = await service.getUserStatistics('admin-1');

    expect(stats.active).toBe(5);
    expect(stats.byRole.admin).toBe(1);
    expect(stats.byRole.user).toBe(1);
    expect(stats.byRole['no-role']).toBe(1);
  });

  it('returns user activity details', async () => {
    const updatedAt = new Date('2025-01-05T00:00:00.000Z');
    userRepository.findOne.mockResolvedValue({
      id: 'u1',
      email: 'u@example.com',
      updatedAt,
      roles: [],
    });
    auditLogRepository.find.mockResolvedValue([{ id: 'a1' }] as any);

    const result = await service.getUserActivity('u1', 'admin-1');

    expect(result.user.id).toBe('u1');
    expect(result.lastActive).toBe(updatedAt);
    expect(result.auditHistory).toHaveLength(1);
  });

  it('exports user data with related resources', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'u1',
      email: 'u@example.com',
      roles: [],
    });
    sessionRepository.find.mockResolvedValue([{ id: 's1' }]);
    transferRepository.find
      .mockResolvedValueOnce([{ id: 't-sent' }])
      .mockResolvedValueOnce([{ id: 't-rec' }]);
    messageRepository.find.mockResolvedValue([{ id: 'm1' }]);
    auditLogRepository.find.mockResolvedValue([{ id: 'log-1' }] as any);
    (auditLogService.getDataAccessLogsForUser as jest.Mock).mockResolvedValue([
      { id: 'd1' },
    ]);

    const exportData = await service.exportUserData('u1', 'admin-1');

    expect(exportData.user.id).toBe('u1');
    expect(exportData.sessions).toHaveLength(1);
    expect(exportData.transfersSent).toHaveLength(1);
    expect(exportData.dataAccessLogs).toHaveLength(1);
  });

  it('deletes user with anonymization and room cleanup', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-12345-abc',
      email: 'victim@example.com',
      username: 'victim',
      roles: [{ name: 'user' }],
    });
    (transferBalanceService.getBalance as jest.Mock).mockResolvedValue(0);
    userRepository.save.mockImplementation(async (u) => u);
    roomRepository.find.mockResolvedValue([{ id: 'room-1' }]);
    roomMemberRepository.count.mockResolvedValue(1);
    messageRepository.update.mockResolvedValue({ affected: 2 });
    sessionRepository.update.mockResolvedValue({ affected: 3 });

    const result = await service.deleteUser(
      'user-12345-abc',
      { reason: 'request', confirmEmail: 'victim@example.com' } as any,
      'admin-1',
      false,
    );

    expect(result.message).toContain('successfully deleted');
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.stringContaining('deleted_'),
        username: '[deleted]',
        isBanned: true,
      }),
    );
    expect(roomRepository.update).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({ isDeleted: true }),
    );
  });

  it('rejects delete when confirmation email mismatches', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      roles: [],
    });

    await expect(
      service.deleteUser(
        'u1',
        { reason: 'x', confirmEmail: 'other@example.com' } as any,
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects delete with non-zero balance without force', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      username: 'u',
      roles: [],
    });
    (transferBalanceService.getBalance as jest.Mock).mockResolvedValue(10.5);

    await expect(
      service.deleteUser(
        'u1',
        { reason: 'x', confirmEmail: 'user@example.com' } as any,
        'admin-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('gets configs and updates config with cache invalidation', async () => {
    platformConfigRepository.find.mockResolvedValue([{ key: 'feature_x' }]);
    platformConfigRepository.findOne.mockResolvedValue({
      key: 'feature_x',
      value: { enabled: false },
      updatedBy: null,
    });
    platformConfigRepository.save.mockImplementation(async (v) => v);

    const list = await service.getConfigs();
    const updated = await service.updateConfig(
      'feature_x',
      { value: { enabled: true }, reason: 'enable flag' } as any,
      'admin-1',
    );

    expect(list).toHaveLength(1);
    expect(updated.value).toEqual({ enabled: true });
    expect(redisService.del).toHaveBeenCalledWith('platform_config:feature_x');
  });

  it('returns config values from cache or db with default fallback', async () => {
    (redisService.get as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ enabled: true }),
    );
    const fromCache = await service.getConfigValue('feature_x', {
      enabled: false,
    });
    expect(fromCache).toEqual({ enabled: true });

    (redisService.get as jest.Mock).mockResolvedValueOnce(null);
    platformConfigRepository.findOne.mockResolvedValueOnce({
      key: 'feature_x',
      value: { enabled: false },
    });
    const fromDb = await service.getConfigValue('feature_x', { enabled: true });
    expect(fromDb).toEqual({ enabled: false });
    expect(redisService.set).toHaveBeenCalled();

    (redisService.get as jest.Mock).mockResolvedValueOnce(null);
    platformConfigRepository.findOne.mockResolvedValueOnce(null);
    const fallback = await service.getConfigValue('missing', 42);
    expect(fallback).toBe(42);
  });

  it('builds revenue analytics summary', async () => {
    const paymentQb = makeQueryBuilder();
    paymentQb.getMany.mockResolvedValue([
      {
        platformFee: '0.50000000',
        blockchainNetwork: 'stellar',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    ]);
    roomPaymentRepository.createQueryBuilder.mockReturnValue(paymentQb);

    const tipsQb = makeQueryBuilder();
    tipsQb.getMany.mockResolvedValue([
      {
        metadata: { platformFee: '0.25000000', blockchainNetwork: 'stellar' },
        createdAt: new Date('2025-01-01T01:00:00.000Z'),
      },
    ]);
    messageRepository.createQueryBuilder.mockReturnValue(tipsQb);

    const result = await service.getRevenueAnalytics(
      { period: RevenuePeriod.DAY, chain: 'stellar' } as any,
      'admin-1',
    );

    expect(result.totalRevenue).toBe('0.75000000');
    expect(result.byType.tips).toBe('0.25000000');
    expect(result.transactionCount).toBe(2);
  });

  it('returns cached overview analytics when present', async () => {
    (cacheService.get as jest.Mock).mockResolvedValue({
      users: { total: 10 },
    });

    const result = await service.getOverviewAnalytics(
      { period: AnalyticsPeriod.WEEK } as any,
      'admin-1',
    );

    expect(result).toEqual({ users: { total: 10 } });
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  it('computes overview analytics and caches the response', async () => {
    (cacheService.get as jest.Mock).mockResolvedValue(null);
    userRepository.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(10);
    const sessionQb = makeQueryBuilder();
    sessionQb.getRawOne.mockResolvedValue({ count: '8' });
    sessionRepository.createQueryBuilder.mockReturnValue(sessionQb);
    const roomActivityQb = makeQueryBuilder();
    roomActivityQb.getRawOne.mockResolvedValue({ count: '4' });
    const topRoomsQb = makeQueryBuilder();
    topRoomsQb.getRawAndEntities.mockResolvedValue({
      raw: [{ activeMembers: '3' }],
      entities: [
        {
          id: 'room-1',
          name: 'General',
          memberCount: 5,
          owner: { id: 'u1', username: 'owner' },
        },
      ],
    });
    roomRepository.createQueryBuilder
      .mockReturnValueOnce(roomActivityQb)
      .mockReturnValueOnce(topRoomsQb);
    roomRepository.count.mockResolvedValueOnce(15);
    roomRepository.count.mockResolvedValueOnce(3);
    messageRepository.count.mockResolvedValue(40);
    const roomPaymentQb = makeQueryBuilder();
    roomPaymentQb.getMany.mockResolvedValue([
      { amount: '10.00', platformFee: '1.00' },
    ]);
    roomPaymentRepository.createQueryBuilder.mockReturnValue(roomPaymentQb);
    const tipsQb = makeQueryBuilder();
    tipsQb.getMany.mockResolvedValue([
      { metadata: { amount: '5.00', platformFee: '0.50' } },
    ]);
    tipsQb.getRawMany.mockResolvedValue([
      {
        author_id: 'u2',
        author_username: 'tipper',
        tipCount: '2',
        totalAmount: '5.00',
      },
    ]);
    messageRepository.createQueryBuilder.mockReturnValue(tipsQb);

    const result = await service.getOverviewAnalytics(
      { period: AnalyticsPeriod.MONTH } as any,
      'admin-1',
    );

    expect(result.users.total).toBe(100);
    expect(result.rooms.total).toBe(15);
    expect(result.transactions.totalVolume).toBe('15.00');
    expect(result.topTippers[0].userId).toBe('u2');
    expect(cacheService.set).toHaveBeenCalledWith(
      'admin:overview:month',
      expect.any(Object),
      300,
    );
  });

  it('manages sessions and password reset flows', async () => {
    sessionRepository.find.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    const sessions = await service.getUserSessions('u1');
    expect(sessions.total).toBe(2);

    await service.terminateSession('u1', 's1', 'admin-1');
    await service.terminateAllUserSessions('u1', 'admin-1');
    expect(sessionRepository.update).toHaveBeenCalled();

    userRepository.findOne.mockResolvedValue({
      id: 'u1',
      email: 'u@example.com',
    });
    const sessionUpdateQb = makeQueryBuilder();
    sessionRepository.createQueryBuilder.mockReturnValue(sessionUpdateQb);
    const reset = await service.adminResetPassword('u1', 'admin-1');
    expect(reset.message).toContain('Password reset email');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'user.password.reset.admin',
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  it('returns room details with paginated payments', async () => {
    roomRepository.findOne.mockResolvedValue({
      id: 'room-1',
      owner: { id: 'u1', username: 'owner' },
    });
    roomPaymentRepository.findAndCount.mockResolvedValue([[{ id: 'p1' }], 1]);

    const details = await service.getRoomDetails(
      'room-1',
      { page: 2, limit: 5 } as any,
      'admin-1',
    );

    expect(details.totalPayments).toBe(1);
    expect(details.page).toBe(2);
    expect(details.limit).toBe(5);
  });
});
