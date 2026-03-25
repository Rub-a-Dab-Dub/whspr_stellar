import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { AuditLogRepository, CreateAuditLogInput } from './audit-log.repository';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { AuditLogExportDto } from './dto/audit-log-export.dto';
import { AuditLogResponseDto, PaginatedAuditLogResponseDto } from './dto/audit-log-response.dto';

const CSV_HEADER =
  'id,actorId,targetId,action,resource,resourceId,ipAddress,userAgent,metadata,createdAt\n';
const DEFAULT_RETENTION_DAYS = 90;

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly repo: AuditLogRepository,
    private readonly config: ConfigService,
  ) {}

  // ── Write ─────────────────────────────────────────────────────────────────

  async log(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.repo.create(input);
    } catch (err) {
      // Audit logging must never break the primary request flow.
      this.logger.error('Failed to write audit log entry', (err as Error).stack);
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getLogsForUser(
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedAuditLogResponseDto> {
    const [logs, total] = await this.repo.findWithFilters({ actorId: userId, page, limit });
    return this.toPaginated(logs, total, page, limit);
  }

  async getLogsForResource(
    resource: string,
    resourceId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedAuditLogResponseDto> {
    const [logs, total] = await this.repo.findWithFilters({ resource, page, limit });
    return this.toPaginated(logs, total, page, limit);
  }

  async searchLogs(filters: AuditLogFilterDto): Promise<PaginatedAuditLogResponseDto> {
    const [logs, total] = await this.repo.findWithFilters(filters);
    return this.toPaginated(logs, total, filters.page ?? 1, filters.limit ?? 50);
  }

  async findById(id: string): Promise<AuditLogResponseDto> {
    const log = await this.repo.findById(id);
    if (!log) throw new NotFoundException(`Audit log ${id} not found`);
    return plainToInstance(AuditLogResponseDto, log, { excludeExtraneousValues: true });
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async exportLogs(filters: AuditLogExportDto): Promise<string> {
    const logs = await this.repo.findForExport(filters);

    const rows = logs.map((l) => {
      const meta = l.metadata ? JSON.stringify(l.metadata).replace(/"/g, '""') : '';
      const ua = (l.userAgent ?? '').replace(/"/g, '""');
      return [
        l.id,
        l.actorId ?? '',
        l.targetId ?? '',
        l.action,
        l.resource,
        l.resourceId ?? '',
        l.ipAddress ?? '',
        `"${ua}"`,
        `"${meta}"`,
        l.createdAt.toISOString(),
      ].join(',');
    });

    return CSV_HEADER + rows.join('\n');
  }

  // ── Retention ─────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async applyRetentionPolicy(): Promise<void> {
    const retentionDays = this.config.get<number>(
      'AUDIT_LOG_RETENTION_DAYS',
      DEFAULT_RETENTION_DAYS,
    );
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const deleted = await this.repo.deleteOlderThan(cutoff);
    if (deleted > 0) {
      this.logger.log(
        `Audit log retention: removed ${deleted} entries older than ${retentionDays} days`,
      );
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toPaginated(
    logs: any[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedAuditLogResponseDto {
    return {
      data: logs.map((l) =>
        plainToInstance(AuditLogResponseDto, l, { excludeExtraneousValues: true }),
      ),
      total,
      page,
      limit,
    };
  }
}
