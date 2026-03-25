import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThan, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { AuditLogExportDto } from './dto/audit-log-export.dto';
import { AuditActionType } from './constants/audit-actions';

export interface CreateAuditLogInput {
  actorId: string | null;
  targetId?: string | null;
  action: AuditActionType;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const entry = this.repo.create(input);
    return this.repo.save(entry);
  }

  async findById(id: string): Promise<AuditLog | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findWithFilters(filters: AuditLogFilterDto): Promise<[AuditLog[], number]> {
    const { actorId, targetId, action, resource, from, to, page = 1, limit = 50 } = filters;

    const where: FindOptionsWhere<AuditLog> = {};

    if (actorId) where.actorId = actorId;
    if (targetId) where.targetId = targetId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (from && to) {
      where.createdAt = Between(new Date(from), new Date(to));
    }

    return this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findForExport(filters: AuditLogExportDto): Promise<AuditLog[]> {
    const where: FindOptionsWhere<AuditLog> = {};

    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.action) where.action = filters.action;
    if (filters.from && filters.to) {
      where.createdAt = Between(new Date(filters.from), new Date(filters.to));
    }

    return this.repo.find({ where, order: { createdAt: 'ASC' } });
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.repo.delete({ createdAt: LessThan(date) });
    return result.affected ?? 0;
  }
}
