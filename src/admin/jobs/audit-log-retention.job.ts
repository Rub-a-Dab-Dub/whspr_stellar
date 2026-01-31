import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditLogService } from '../services/audit-log.service';

@Injectable()
export class AuditLogRetentionJob {
  private readonly logger = new Logger(AuditLogRetentionJob.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleRetention() {
    const result = await this.auditLogService.archiveAndPurge();
    this.logger.log(
      `Audit log retention complete. Archived: ${result.archived}, Purged: ${result.purged}`,
    );
  }
}
