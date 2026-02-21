import { ConfigService } from '@nestjs/config';
import { AuditLogService } from './audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { DataAccessAction } from '../entities/data-access-log.entity';
import { AuditAlertType } from '../entities/audit-alert.entity';

type MockRepo = {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  createQueryBuilder: jest.Mock;
  find: jest.Mock;
  count: jest.Mock;
};

const makeQueryBuilder = () => {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
  };
  return qb;
};

describe('AuditLogService', () => {
  let service: AuditLogService;
  let auditLogRepository: MockRepo;
  let auditLogArchiveRepository: MockRepo;
  let dataAccessLogRepository: MockRepo;
  let auditAlertRepository: MockRepo;
  let configService: Pick<ConfigService, 'get'>;

  beforeEach(() => {
    auditLogRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    };

    auditLogArchiveRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    };

    dataAccessLogRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      find: jest.fn(async () => []),
      count: jest.fn(),
    };

    auditAlertRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          AUDIT_LOG_ARCHIVE_AFTER_DAYS: '30',
          AUDIT_LOG_RETENTION_DAYS: '365',
          AUDIT_ALERT_LOGIN_WINDOW_MINUTES: '15',
          AUDIT_ALERT_LOGIN_THRESHOLD: '3',
          AUDIT_ALERT_BULK_THRESHOLD: '10',
          AUDIT_ALERT_TX_FAIL_WINDOW_MINUTES: '30',
          AUDIT_ALERT_TX_FAIL_THRESHOLD: '2',
        };
        return map[key];
      }),
    };

    service = new AuditLogService(
      auditLogRepository as any,
      auditLogArchiveRepository as any,
      dataAccessLogRepository as any,
      auditAlertRepository as any,
      configService as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates audit log with hash and triggers alert evaluation', async () => {
    auditLogRepository.findOne.mockResolvedValue({ hash: 'previous-hash' });
    auditLogRepository.count.mockResolvedValue(5);

    const saved = await service.createAuditLog({
      actorUserId: 'admin-1',
      action: AuditAction.AUTH_LOGIN_FAILED,
      eventType: AuditEventType.AUTH,
      outcome: AuditOutcome.FAILURE,
      severity: AuditSeverity.HIGH,
      metadata: { attempt: 1 },
      req: {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any,
    });

    expect(saved.hash).toBeTruthy();
    expect(auditLogRepository.save).toHaveBeenCalled();
    expect(auditAlertRepository.save).toHaveBeenCalled();
    expect(auditAlertRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: AuditAlertType.AUTH_BRUTE_FORCE }),
    );
  });

  it('logs data-access entries', async () => {
    const saved = await service.logDataAccess({
      actorUserId: 'admin-1',
      targetUserId: 'user-1',
      action: DataAccessAction.VIEW,
      resourceType: 'user',
      resourceId: 'user-1',
      details: 'Viewed profile',
    });

    expect(saved.resourceType).toBe('user');
    expect(dataAccessLogRepository.save).toHaveBeenCalled();
  });

  it('searches audit logs using normalized aliases', async () => {
    const qb = makeQueryBuilder();
    qb.getManyAndCount.mockResolvedValue([[{ id: 'log-1' }], 1]);
    auditLogRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.searchAuditLogs({
      page: 2,
      limit: 25,
      actorUserId: 'admin-1',
      targetType: 'user',
      targetId: 'user-1',
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-12-31T00:00:00.000Z',
      search: 'login',
    });

    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(25);
    expect(qb.andWhere).toHaveBeenCalled();
    expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(2);
  });

  it('exports audit logs as CSV and JSON', async () => {
    const searchSpy = jest.spyOn(service, 'searchAuditLogs').mockResolvedValue({
      logs: [
        {
          id: 'log-1',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          eventType: AuditEventType.ADMIN,
          action: AuditAction.USER_BANNED,
          actorUserId: 'admin-1',
          targetUserId: 'user-1',
          resourceType: 'user',
          resourceId: 'user-1',
          outcome: AuditOutcome.SUCCESS,
          severity: AuditSeverity.HIGH,
          details: 'Banned user',
          metadata: { reason: 'abuse' },
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
          previousHash: null,
          hash: 'abc',
        } as any,
      ],
      total: 1,
      page: 1,
      limit: 1000,
    });

    const csv = await service.exportAuditLogs({}, 'csv');
    const json = await service.exportAuditLogs({}, 'json');

    expect(searchSpy).toHaveBeenCalledTimes(2);
    expect(csv.contentType).toBe('text/csv');
    expect(csv.data).toContain('"log-1"');
    expect(json.contentType).toBe('application/json');
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('archives and purges old logs in batches', async () => {
    const oldLog = {
      id: 'log-1',
      eventType: AuditEventType.ADMIN,
      action: AuditAction.USER_BANNED,
      actorUserId: 'admin-1',
      targetUserId: 'user-1',
      resourceType: 'user',
      resourceId: 'user-1',
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: 'old',
      metadata: null,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      previousHash: null,
      hash: 'h1',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    };

    auditLogRepository.find
      .mockResolvedValueOnce([oldLog])
      .mockResolvedValueOnce([]);

    const deleteQb = makeQueryBuilder();
    auditLogRepository.createQueryBuilder.mockReturnValue(deleteQb);

    const purgeQb = makeQueryBuilder();
    purgeQb.execute.mockResolvedValue({ affected: 2 });
    auditLogArchiveRepository.createQueryBuilder.mockReturnValue(purgeQb);

    const result = await service.archiveAndPurge();

    expect(auditLogArchiveRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ hash: 'h1' })]),
    );
    expect(deleteQb.execute).toHaveBeenCalled();
    expect(result.archived).toBe(1);
    expect(result.purged).toBe(2);
  });

  it('returns data-access logs for a user', async () => {
    dataAccessLogRepository.find.mockResolvedValue([{ id: 'd1' }]);

    const logs = await service.getDataAccessLogsForUser('user-1');

    expect(dataAccessLogRepository.find).toHaveBeenCalledWith({
      where: { targetUserId: 'user-1' },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    expect(logs).toEqual([{ id: 'd1' }]);
  });

  it('creates bulk-action and transfer-failure alerts when thresholds are reached', async () => {
    auditLogRepository.findOne.mockResolvedValue(null);
    auditLogRepository.count.mockResolvedValue(3);

    await service.createAuditLog({
      actorUserId: 'admin-1',
      action: AuditAction.BULK_ACTION,
      eventType: AuditEventType.ADMIN,
      metadata: { count: 15 },
      req: { ip: '10.0.0.1', headers: {} } as any,
    });

    await service.createAuditLog({
      actorUserId: 'admin-1',
      action: AuditAction.TRANSFER_FAILED,
      eventType: AuditEventType.ADMIN,
      req: { ip: '10.0.0.2', headers: {} } as any,
    });

    await service.createAuditLog({
      actorUserId: 'admin-1',
      targetUserId: 'user-2',
      action: AuditAction.DATA_EXPORT,
      eventType: AuditEventType.ADMIN,
      req: { ip: '10.0.0.3', headers: {} } as any,
    });

    expect(auditAlertRepository.save).toHaveBeenCalledTimes(3);
  });
});
