import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AdminAuditLog } from './entities';
import { CreateAdminAuditLogDto, AdminAuditLogFilterDto } from './dto';

@Injectable()
export class AdminAuditLogService {
  private readonly logger = new Logger(AdminAuditLogService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly adminAuditLogRepository: Repository<AdminAuditLog>,
  ) {}

  /**
   * Log an admin action asynchronously (fire-and-forget pattern)
   * Errors are captured and logged but do not throw
   * @param createAdminAuditLogDto - The audit log data
   */
  async log(createAdminAuditLogDto: CreateAdminAuditLogDto): Promise<void> {
    try {
      const auditLog = this.adminAuditLogRepository.create(
        createAdminAuditLogDto,
      );
      await this.adminAuditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error(
        `Failed to log admin action: ${error.message}`,
        error.stack,
        {
          adminId: createAdminAuditLogDto.adminId,
          action: createAdminAuditLogDto.action,
        },
      );
      // Error is captured but not thrown - non-blocking behavior
    }
  }

  /**
   * Log multiple admin actions asynchronously (fire-and-forget pattern)
   * @param createAdminAuditLogDtos - Array of audit log data
   */
  logBatch(createAdminAuditLogDtos: CreateAdminAuditLogDto[]): Promise<void> {
    return new Promise((resolve) => {
      this.logBatchInternal(createAdminAuditLogDtos).finally(() => {
        resolve();
      });
    });
  }

  private async logBatchInternal(
    createAdminAuditLogDtos: CreateAdminAuditLogDto[],
  ): Promise<void> {
    try {
      const auditLogs = this.adminAuditLogRepository.create(
        createAdminAuditLogDtos,
      );
      await this.adminAuditLogRepository.save(auditLogs);
    } catch (error) {
      this.logger.error(
        `Failed to batch log admin actions: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Find all audit logs with pagination and filtering
   * @param filters - Filter criteria
   * @returns Paginated audit logs
   */
  async findAll(filters: AdminAuditLogFilterDto) {
    const query = this.adminAuditLogRepository.createQueryBuilder('auditLog');

    if (filters.adminId) {
      query.andWhere('auditLog.adminId = :adminId', {
        adminId: filters.adminId,
      });
    }

    if (filters.action) {
      query.andWhere('auditLog.action = :action', {
        action: filters.action,
      });
    }

    if (filters.targetType) {
      query.andWhere('auditLog.targetType = :targetType', {
        targetType: filters.targetType,
      });
    }

    if (filters.targetId) {
      query.andWhere('auditLog.targetId = :targetId', {
        targetId: filters.targetId,
      });
    }

    if (filters.ipAddress) {
      query.andWhere('auditLog.ipAddress = :ipAddress', {
        ipAddress: filters.ipAddress,
      });
    }

    if (filters.startDate) {
      query.andWhere('auditLog.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      query.andWhere('auditLog.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, filters.limit || 20);
    const skip = (page - 1) * limit;

    const [data, total] = await query
      .orderBy('auditLog.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find logs by admin ID
   */
  async findByAdminId(adminId: string, limit: number = 20, offset: number = 0) {
    const [data, total] = await this.adminAuditLogRepository.findAndCount({
      where: { adminId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  /**
   * Find logs within a date range
   */
  async findByDateRange(startDate: Date, endDate: Date, limit: number = 20) {
    const data = await this.adminAuditLogRepository.find({
      where: {
        createdAt: MoreThanOrEqual(startDate),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    // Filter by endDate in-memory since TypeORM's between is not reliable with dates
    return data.filter((log) => log.createdAt <= endDate);
  }

  /**
   * Get audit log by ID
   */
  async findById(id: string) {
    return this.adminAuditLogRepository.findOne({
      where: { id },
    });
  }

  /**
   * Count logs by action
   */
  async countByAction(action: string) {
    return this.adminAuditLogRepository.count({
      where: { action },
    });
  }

  /**
   * Get distinct admin IDs
   */
  async getAdminIds() {
    const logs = await this.adminAuditLogRepository.query(
      'SELECT DISTINCT "adminId" FROM admin_audit_logs ORDER BY "adminId"',
    );
    return logs.map((log) => log.adminId);
  }
}
