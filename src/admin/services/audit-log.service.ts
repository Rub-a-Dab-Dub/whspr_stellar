import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual } from 'typeorm';
import { Request } from 'express';
import { createHash } from 'crypto';
import {
  AuditLog,
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { AuditLogArchive } from '../entities/audit-log-archive.entity';
import { DataAccessLog, DataAccessAction } from '../entities/data-access-log.entity';
import { AuditAlert, AuditAlertType, AuditAlertSeverity } from '../entities/audit-alert.entity';
import { ConfigService } from '@nestjs/config';

export type AuditLogInput = {
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: AuditAction;
  eventType: AuditEventType;
  outcome?: AuditOutcome | null;
  severity?: AuditSeverity | null;
  resourceType?: string | null;
  resourceId?: string | null;
  details?: string | null;
  metadata?: Record<string, any> | null;
  req?: Request;
};

export type AuditLogFilters = {
  page?: number;
  limit?: number;
  actorUserId?: string;
  targetUserId?: string;
  actions?: string[];
  eventType?: AuditEventType;
  outcome?: AuditOutcome;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
};

export type DataAccessLogInput = {
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: DataAccessAction;
  resourceType: string;
  resourceId?: string | null;
  details?: string | null;
  metadata?: Record<string, any> | null;
  req?: Request;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(AuditLogArchive)
    private readonly auditLogArchiveRepository: Repository<AuditLogArchive>,
    @InjectRepository(DataAccessLog)
    private readonly dataAccessLogRepository: Repository<DataAccessLog>,
    @InjectRepository(AuditAlert)
    private readonly auditAlertRepository: Repository<AuditAlert>,
    private readonly configService: ConfigService,
  ) {}

  async createAuditLog(input: AuditLogInput): Promise<AuditLog> {
    const createdAt = new Date();
    const previousHash = await this.getLatestHash();
    const ipAddress = this.getIpAddress(input.req);
    const userAgent = this.getUserAgent(input.req);

    const auditLog = this.auditLogRepository.create({
      actorUserId: input.actorUserId || null,
      targetUserId: input.targetUserId || null,
      action: input.action,
      eventType: input.eventType,
      outcome: input.outcome || null,
      severity: input.severity || null,
      resourceType: input.resourceType || null,
      resourceId: input.resourceId || null,
      details: input.details || null,
      metadata: input.metadata || null,
      ipAddress,
      userAgent,
      previousHash,
      createdAt,
      hash: '',
    });

    auditLog.hash = this.computeHash(auditLog);

    const saved = await this.auditLogRepository.save(auditLog);
    await this.evaluateAlerts(saved);
    return saved;
  }

  async logDataAccess(input: DataAccessLogInput): Promise<DataAccessLog> {
    const ipAddress = this.getIpAddress(input.req);
    const userAgent = this.getUserAgent(input.req);

    const dataAccessLog = this.dataAccessLogRepository.create({
      actorUserId: input.actorUserId || null,
      targetUserId: input.targetUserId || null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId || null,
      details: input.details || null,
      metadata: input.metadata || null,
      ipAddress,
      userAgent,
    });

    return await this.dataAccessLogRepository.save(dataAccessLog);
  }

  async searchAuditLogs(filters: AuditLogFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditLogRepository.createQueryBuilder('log');

    if (filters.actorUserId) {
      queryBuilder.andWhere('log.actorUserId = :actorUserId', {
        actorUserId: filters.actorUserId,
      });
    }

    if (filters.targetUserId) {
      queryBuilder.andWhere('log.targetUserId = :targetUserId', {
        targetUserId: filters.targetUserId,
      });
    }

    if (filters.actions && filters.actions.length > 0) {
      queryBuilder.andWhere('log.action IN (:...actions)', {
        actions: filters.actions,
      });
    }

    if (filters.eventType) {
      queryBuilder.andWhere('log.eventType = :eventType', {
        eventType: filters.eventType,
      });
    }

    if (filters.outcome) {
      queryBuilder.andWhere('log.outcome = :outcome', {
        outcome: filters.outcome,
      });
    }

    if (filters.resourceType) {
      queryBuilder.andWhere('log.resourceType = :resourceType', {
        resourceType: filters.resourceType,
      });
    }

    if (filters.resourceId) {
      queryBuilder.andWhere('log.resourceId = :resourceId', {
        resourceId: filters.resourceId,
      });
    }

    if (filters.ipAddress) {
      queryBuilder.andWhere('log.ipAddress = :ipAddress', {
        ipAddress: filters.ipAddress,
      });
    }

    if (filters.userAgent) {
      queryBuilder.andWhere('log.userAgent ILIKE :userAgent', {
        userAgent: `%${filters.userAgent}%`,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(log.details ILIKE :search OR CAST(log.metadata AS TEXT) ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.createdAfter) {
      queryBuilder.andWhere('log.createdAt >= :createdAfter', {
        createdAfter: new Date(filters.createdAfter),
      });
    }

    if (filters.createdBefore) {
      queryBuilder.andWhere('log.createdAt <= :createdBefore', {
        createdBefore: new Date(filters.createdBefore),
      });
    }

    queryBuilder
      .leftJoinAndSelect('log.actorUser', 'actorUser')
      .leftJoinAndSelect('log.targetUser', 'targetUser')
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [logs, total] = await queryBuilder.getManyAndCount();

    return {
      logs,
      total,
      page,
      limit,
    };
  }

  async exportAuditLogs(filters: AuditLogFilters, format: 'json' | 'csv') {
    const { logs } = await this.searchAuditLogs({
      ...filters,
      page: 1,
      limit: Math.min(filters.limit || 1000, 5000),
    });

    if (format === 'csv') {
      const headers = [
        'id',
        'createdAt',
        'eventType',
        'action',
        'actorUserId',
        'targetUserId',
        'resourceType',
        'resourceId',
        'outcome',
        'severity',
        'details',
        'metadata',
        'ipAddress',
        'userAgent',
        'previousHash',
        'hash',
      ];

      const rows = logs.map((log) => [
        log.id,
        log.createdAt?.toISOString(),
        log.eventType,
        log.action,
        log.actorUserId,
        log.targetUserId,
        log.resourceType,
        log.resourceId,
        log.outcome,
        log.severity,
        log.details,
        this.safeStringify(log.metadata),
        log.ipAddress,
        log.userAgent,
        log.previousHash,
        log.hash,
      ]);

      const csv = [headers, ...rows]
        .map((row) =>
          row
            .map((value) => {
              const stringValue = value === null || value === undefined ? '' : String(value);
              return `"${stringValue.replace(/"/g, '""')}"`;
            })
            .join(','),
        )
        .join('\n');

      return { contentType: 'text/csv', data: csv };
    }

    return { contentType: 'application/json', data: logs };
  }

  async archiveAndPurge(): Promise<{ archived: number; purged: number }> {
    const archiveAfterDays = parseInt(
      this.configService.get('AUDIT_LOG_ARCHIVE_AFTER_DAYS') || '30',
      10,
    );
    const retentionDays = parseInt(
      this.configService.get('AUDIT_LOG_RETENTION_DAYS') || '365',
      10,
    );

    const archiveBefore = new Date(Date.now() - archiveAfterDays * 24 * 60 * 60 * 1000);
    const retentionBefore = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    let archived = 0;
    const batchSize = 500;
    let batch = await this.auditLogRepository.find({
      where: { createdAt: LessThan(archiveBefore) },
      order: { createdAt: 'ASC' },
      take: batchSize,
    });

    while (batch.length > 0) {
      const archiveRecords = batch.map((log) =>
        this.auditLogArchiveRepository.create({
          eventType: log.eventType,
          action: log.action,
          actorUserId: log.actorUserId,
          targetUserId: log.targetUserId,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          outcome: log.outcome,
          severity: log.severity,
          details: log.details,
          metadata: log.metadata,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          previousHash: log.previousHash,
          hash: log.hash,
          createdAt: log.createdAt,
          archivedAt: new Date(),
        }),
      );

      await this.auditLogArchiveRepository.save(archiveRecords);
      await this.auditLogRepository
        .createQueryBuilder()
        .delete()
        .from(AuditLog)
        .where('id IN (:...ids)', { ids: batch.map((log) => log.id) })
        .execute();

      archived += batch.length;
      batch = await this.auditLogRepository.find({
        where: { createdAt: LessThan(archiveBefore) },
        order: { createdAt: 'ASC' },
        take: batchSize,
      });
    }

    const purgedResult = await this.auditLogArchiveRepository
      .createQueryBuilder()
      .delete()
      .from(AuditLogArchive)
      .where('archivedAt < :retentionBefore', { retentionBefore })
      .execute();

    return { archived, purged: purgedResult.affected || 0 };
  }

  async getDataAccessLogsForUser(userId: string) {
    return await this.dataAccessLogRepository.find({
      where: { targetUserId: userId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  private async getLatestHash(): Promise<string | null> {
    const latest = await this.auditLogRepository.findOne({
      select: ['hash'],
      order: { createdAt: 'DESC' },
    });

    return latest?.hash || null;
  }

  private computeHash(log: AuditLog): string {
    const payload = [
      log.actorUserId || '',
      log.targetUserId || '',
      log.action,
      log.eventType,
      log.outcome || '',
      log.severity || '',
      log.resourceType || '',
      log.resourceId || '',
      log.details || '',
      this.safeStringify(log.metadata),
      log.ipAddress || '',
      log.userAgent || '',
      log.createdAt.toISOString(),
      log.previousHash || '',
    ].join('|');

    return createHash('sha256').update(payload).digest('hex');
  }

  private safeStringify(value: Record<string, any> | null): string {
    if (!value) {
      return '';
    }

    const sortKeys = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(sortKeys);
      }
      if (obj && typeof obj === 'object') {
        return Object.keys(obj)
          .sort()
          .reduce((acc, key) => {
            acc[key] = sortKeys(obj[key]);
            return acc;
          }, {} as Record<string, any>);
      }
      return obj;
    };

    return JSON.stringify(sortKeys(value));
  }

  private async evaluateAlerts(log: AuditLog) {
    try {
      if (log.action === AuditAction.AUTH_LOGIN_FAILED && log.ipAddress) {
        const windowMinutes = parseInt(
          this.configService.get('AUDIT_ALERT_LOGIN_WINDOW_MINUTES') || '15',
          10,
        );
        const threshold = parseInt(
          this.configService.get('AUDIT_ALERT_LOGIN_THRESHOLD') || '5',
          10,
        );
        const since = new Date(Date.now() - windowMinutes * 60 * 1000);

        const failures = await this.auditLogRepository.count({
          where: {
            action: AuditAction.AUTH_LOGIN_FAILED,
            ipAddress: log.ipAddress,
            createdAt: MoreThanOrEqual(since),
          },
        });

        if (failures >= threshold) {
          await this.auditAlertRepository.save(
            this.auditAlertRepository.create({
              alertType: AuditAlertType.AUTH_BRUTE_FORCE,
              severity: AuditAlertSeverity.HIGH,
              details: `Multiple failed logins from ${log.ipAddress}`,
              metadata: { failures, windowMinutes },
              ipAddress: log.ipAddress,
            }),
          );
        }
      }

      if (log.action === AuditAction.BULK_ACTION) {
        const bulkThreshold = parseInt(
          this.configService.get('AUDIT_ALERT_BULK_THRESHOLD') || '25',
          10,
        );
        const count = log.metadata?.count || 0;
        if (count >= bulkThreshold) {
          await this.auditAlertRepository.save(
            this.auditAlertRepository.create({
              alertType: AuditAlertType.ADMIN_BULK_ACTION,
              severity: AuditAlertSeverity.MEDIUM,
              details: `Bulk admin action affected ${count} users`,
              metadata: { count, actorUserId: log.actorUserId },
              ipAddress: log.ipAddress,
            }),
          );
        }
      }

      if (log.action === AuditAction.TRANSFER_FAILED) {
        const windowMinutes = parseInt(
          this.configService.get('AUDIT_ALERT_TX_FAIL_WINDOW_MINUTES') || '30',
          10,
        );
        const threshold = parseInt(
          this.configService.get('AUDIT_ALERT_TX_FAIL_THRESHOLD') || '3',
          10,
        );
        const since = new Date(Date.now() - windowMinutes * 60 * 1000);

        const failures = await this.auditLogRepository.count({
          where: {
            action: AuditAction.TRANSFER_FAILED,
            createdAt: MoreThanOrEqual(since),
          },
        });

        if (failures >= threshold) {
          await this.auditAlertRepository.save(
            this.auditAlertRepository.create({
              alertType: AuditAlertType.TRANSACTION_FAILURE_SPIKE,
              severity: AuditAlertSeverity.HIGH,
              details: `Spike in failed transfers detected`,
              metadata: { failures, windowMinutes },
              ipAddress: log.ipAddress,
            }),
          );
        }
      }

      if (log.action === AuditAction.DATA_EXPORT) {
        await this.auditAlertRepository.save(
          this.auditAlertRepository.create({
            alertType: AuditAlertType.DATA_EXPORT,
            severity: AuditAlertSeverity.MEDIUM,
            details: 'User data export performed',
            metadata: { actorUserId: log.actorUserId, targetUserId: log.targetUserId },
            ipAddress: log.ipAddress,
          }),
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to evaluate audit alerts: ${error.message}`);
    }
  }

  private getIpAddress(req?: Request): string | null {
    return req?.ip || req?.socket?.remoteAddress || null;
  }

  private getUserAgent(req?: Request): string | null {
    return req?.headers?.['user-agent'] || null;
  }
}
