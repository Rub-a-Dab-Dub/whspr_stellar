import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpWhitelist } from '../entities/ip-whitelist.entity';
import { AddIpWhitelistDto } from '../dto/add-ip-whitelist.dto';
import { AuditLogService } from './audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';

@Injectable()
export class IpWhitelistService {
  constructor(
    @InjectRepository(IpWhitelist)
    private readonly ipWhitelistRepo: Repository<IpWhitelist>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(): Promise<IpWhitelist[]> {
    return this.ipWhitelistRepo.find({
      relations: ['addedByUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    dto: AddIpWhitelistDto,
    userId: string,
    ipAddress: string,
  ): Promise<IpWhitelist> {
    const entry = this.ipWhitelistRepo.create({
      ipCidr: dto.ipCidr,
      description: dto.description,
      addedBy: userId,
    });

    const saved = await this.ipWhitelistRepo.save(entry);

    await this.auditLogService.createAuditLog({
      eventType: AuditEventType.ADMIN,
      action: AuditAction.IP_WHITELIST_ADDED,
      actorUserId: userId,
      resourceType: 'ip_whitelist',
      resourceId: saved.id,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.HIGH,
      details: `Added IP/CIDR ${dto.ipCidr} to whitelist`,
      metadata: { ipCidr: dto.ipCidr, description: dto.description },
    });

    return saved;
  }

  async remove(id: string, userId: string, ipAddress: string): Promise<void> {
    const entry = await this.ipWhitelistRepo.findOne({ where: { id } });

    if (entry) {
      await this.ipWhitelistRepo.remove(entry);

      await this.auditLogService.createAuditLog({
        eventType: AuditEventType.ADMIN,
        action: AuditAction.IP_WHITELIST_REMOVED,
        actorUserId: userId,
        resourceType: 'ip_whitelist',
        resourceId: id,
        outcome: AuditOutcome.SUCCESS,
        severity: AuditSeverity.HIGH,
        details: `Removed IP/CIDR ${entry.ipCidr} from whitelist`,
        metadata: { ipCidr: entry.ipCidr },
      });
    }
  }
}
