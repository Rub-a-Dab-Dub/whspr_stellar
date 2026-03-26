import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit-log.service';
import { AuditLogRepository } from '../audit-log.repository';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditAction } from '../constants/audit-actions';

const makeEntry = (overrides: Partial<AuditLog> = {}): AuditLog =>
  Object.assign(new AuditLog(), {
    id: 'log-1',
    actorId: 'user-1',
    targetId: null,
    action: AuditAction.AUTH_LOGIN,
    resource: 'auth',
    resourceId: null,
    ipAddress: '127.0.0.1',
    userAgent: 'Jest',
    metadata: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  });

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: jest.Mocked<AuditLogRepository>;

  beforeEach(async () => {
    const repoMock: jest.Mocked<AuditLogRepository> = {
      create: jest.fn(),
      findById: jest.fn(),
      findWithFilters: jest.fn(),
      findForExport: jest.fn(),
      deleteOlderThan: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: AuditLogRepository, useValue: repoMock },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(90) },
        },
      ],
    }).compile();

    service = module.get(AuditLogService);
    repo = module.get(AuditLogRepository);
  });

  // ── log ───────────────────────────────────────────────────────────────────

  describe('log', () => {
    it('creates an audit log entry', async () => {
      repo.create.mockResolvedValue(makeEntry());

      await service.log({
        actorId: 'user-1',
        action: AuditAction.AUTH_LOGIN,
        resource: 'auth',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.AUTH_LOGIN }),
      );
    });

    it('silently swallows errors so the primary flow is not broken', async () => {
      repo.create.mockRejectedValue(new Error('DB down'));
      await expect(
        service.log({ actorId: 'u1', action: AuditAction.AUTH_LOGIN, resource: 'auth' }),
      ).resolves.toBeUndefined();
    });
  });

  // ── getLogsForUser ────────────────────────────────────────────────────────

  describe('getLogsForUser', () => {
    it('returns paginated logs for the given user', async () => {
      repo.findWithFilters.mockResolvedValue([[makeEntry()], 1]);

      const result = await service.getLogsForUser('user-1');

      expect(repo.findWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'user-1' }),
      );
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  // ── searchLogs ────────────────────────────────────────────────────────────

  describe('searchLogs', () => {
    it('forwards filters to repository and paginates', async () => {
      repo.findWithFilters.mockResolvedValue([[makeEntry(), makeEntry()], 2]);

      const result = await service.searchLogs({
        action: AuditAction.AUTH_LOGIN,
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns a log entry by ID', async () => {
      repo.findById.mockResolvedValue(makeEntry());
      const result = await service.findById('log-1');
      expect(result.id).toBe('log-1');
    });

    it('throws NotFoundException for unknown ID', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById('nope')).rejects.toThrow(NotFoundException);
    });
  });

  // ── exportLogs ────────────────────────────────────────────────────────────

  describe('exportLogs', () => {
    it('generates a valid CSV string with headers', async () => {
      repo.findForExport.mockResolvedValue([makeEntry()]);

      const csv = await service.exportLogs({});

      expect(csv).toContain('id,actorId,targetId,action');
      expect(csv).toContain('log-1');
      expect(csv).toContain('AUTH_LOGIN');
    });

    it('returns only the header row when no logs found', async () => {
      repo.findForExport.mockResolvedValue([]);
      const csv = await service.exportLogs({});
      const lines = csv.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('id,actorId');
    });

    it('escapes double quotes in userAgent and metadata fields', async () => {
      repo.findForExport.mockResolvedValue([
        makeEntry({ userAgent: 'Mozilla "test"', metadata: { key: 'val"ue' } }),
      ]);
      const csv = await service.exportLogs({});
      expect(csv).toContain('""test""');
    });
  });

  // ── applyRetentionPolicy ──────────────────────────────────────────────────

  describe('applyRetentionPolicy', () => {
    it('deletes entries older than the configured retention period', async () => {
      repo.deleteOlderThan.mockResolvedValue(42);

      await service.applyRetentionPolicy();

      expect(repo.deleteOlderThan).toHaveBeenCalledWith(expect.any(Date));
    });

    it('does not log when nothing was deleted', async () => {
      repo.deleteOlderThan.mockResolvedValue(0);
      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.applyRetentionPolicy();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
