import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WithdrawalAuditLog,
  AuditAction,
} from '../entities/withdrawal-audit-log.entity';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(WithdrawalAuditLog)
    private readonly auditRepo: Repository<WithdrawalAuditLog>,
  ) {}

  async log(params: {
    withdrawalRequestId: string;
    adminId?: string;
    adminUsername?: string;
    action: AuditAction;
    reason?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
  }): Promise<WithdrawalAuditLog> {
    const log = this.auditRepo.create(params);
    const saved = await this.auditRepo.save(log);

    this.logger.log(
      `AUDIT [${params.action}] requestId=${params.withdrawalRequestId} ` +
        `admin=${params.adminUsername || 'SYSTEM'} reason=${params.reason || 'N/A'}`,
    );

    return saved;
  }

  async findByWithdrawalId(
    withdrawalRequestId: string,
  ): Promise<WithdrawalAuditLog[]> {
    return this.auditRepo.find({
      where: { withdrawalRequestId },
      order: { createdAt: 'DESC' },
    });
  }
}
