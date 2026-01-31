import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../user/entities/user.entity';
import {
  AuditLog,
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from './entities/audit-log.entity';
import { GetUsersDto, UserFilterStatus } from './dto/get-users.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { BulkActionDto, BulkActionType } from './dto/bulk-action.dto';
import { Request } from 'express';
import { AuditLogService, AuditLogFilters } from './services/audit-log.service';
import { DataAccessAction } from './entities/data-access-log.entity';
import { Transfer } from '../transfer/entities/transfer.entity';
import { Session } from '../sessions/entities/session.entity';
import { Message } from '../message/entities/message.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async logAudit(
    actorUserId: string | null,
    action: AuditAction,
    targetUserId: string | null,
    details: string | null = null,
    metadata: Record<string, any> | null = null,
    req?: Request,
    severity: AuditSeverity | null = AuditSeverity.MEDIUM,
    resourceType?: string | null,
    resourceId?: string | null,
  ): Promise<AuditLog> {
    const resolvedResourceType =
      resourceType ?? (targetUserId ? 'user' : 'admin');
    const resolvedResourceId = resourceId ?? targetUserId;

    return await this.auditLogService.createAuditLog({
      actorUserId,
      targetUserId,
      action,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity,
      details,
      metadata,
      resourceType: resolvedResourceType,
      resourceId: resolvedResourceId,
      req,
    });
  }

  private async safeLogDataAccess(
    input: Parameters<AuditLogService['logDataAccess']>[0],
  ) {
    try {
      await this.auditLogService.logDataAccess(input);
    } catch (error) {
      this.logger.warn(`Failed to log data access: ${error.message}`);
    }
  }

  async getUsers(
    query: GetUsersDto,
    adminId: string,
    req?: Request,
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const {
      search,
      status,
      isBanned,
      isSuspended,
      isVerified,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      createdAfter,
      createdBefore,
    } = query;

    const skip = (page - 1) * limit;
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Search
    if (search) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Status filter
    if (status && status !== UserFilterStatus.ALL) {
      if (status === UserFilterStatus.BANNED) {
        queryBuilder.andWhere('user.isBanned = :isBanned', { isBanned: true });
      } else if (status === UserFilterStatus.SUSPENDED) {
        queryBuilder.andWhere('user.suspendedUntil > :now', { now: new Date() });
      }
    }

    // Boolean filters
    if (isBanned !== undefined) {
      queryBuilder.andWhere('user.isBanned = :isBanned', { isBanned });
    }

    if (isSuspended !== undefined) {
      if (isSuspended) {
        queryBuilder.andWhere('user.suspendedUntil > :now', { now: new Date() });
      } else {
        queryBuilder.andWhere(
          '(user.suspendedUntil IS NULL OR user.suspendedUntil <= :now)',
          { now: new Date() },
        );
      }
    }

    if (isVerified !== undefined) {
      queryBuilder.andWhere('user.isVerified = :isVerified', { isVerified });
    }

    // Date range filters
    if (createdAfter) {
      queryBuilder.andWhere('user.createdAt >= :createdAfter', {
        createdAfter: new Date(createdAfter),
      });
    }

    if (createdBefore) {
      queryBuilder.andWhere('user.createdAt <= :createdBefore', {
        createdBefore: new Date(createdBefore),
      });
    }

    // Sorting
    queryBuilder.orderBy(`user.${sortBy}`, sortOrder);

    // Pagination
    queryBuilder.skip(skip).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    // Log the view action
    await this.logAudit(
      adminId,
      AuditAction.USER_VIEWED,
      null,
      `Viewed ${users.length} users`,
      { filters: query },
      req,
    );

    await this.safeLogDataAccess({
      actorUserId: adminId,
      action: DataAccessAction.VIEW,
      resourceType: 'user_list',
      details: 'Viewed user list',
      metadata: { filters: query, count: users.length },
      req,
    });

    return {
      users,
      total,
      page,
      limit,
    };
  }

  async getUserDetail(userId: string, adminId: string, req?: Request): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.logAudit(
      adminId,
      AuditAction.USER_VIEWED,
      userId,
      `Viewed user details: ${user.email}`,
      null,
      req,
    );

    await this.safeLogDataAccess({
      actorUserId: adminId,
      targetUserId: userId,
      action: DataAccessAction.VIEW,
      resourceType: 'user',
      resourceId: userId,
      details: 'Viewed user details',
      metadata: { email: user.email },
      req,
    });

    return user;
  }

  async banUser(
    userId: string,
    adminId: string,
    banDto: BanUserDto,
    req?: Request,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isBanned) {
      throw new BadRequestException('User is already banned');
    }

    // Prevent banning admins - load roles if not already loaded
    let userWithRoles = user;
    if (!user.roles || user.roles.length === 0) {
      userWithRoles = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['roles'],
      });
    }
    const userRoles = userWithRoles?.roles || [];
    const isAdmin = userRoles.some((role) => role.name === 'admin');
    if (isAdmin) {
      throw new ForbiddenException('Cannot ban admin users');
    }

    user.isBanned = true;
    user.bannedAt = new Date();
    user.bannedBy = adminId;
    user.banReason = banDto.reason || null;

    const savedUser = await this.userRepository.save(user);

    await this.logAudit(
      adminId,
      AuditAction.USER_BANNED,
      userId,
      banDto.reason || 'User banned',
      { reason: banDto.reason },
      req,
    );

    return savedUser;
  }

  async unbanUser(
    userId: string,
    adminId: string,
    req?: Request,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.isBanned) {
      throw new BadRequestException('User is not banned');
    }

    user.isBanned = false;
    user.bannedAt = null;
    user.bannedBy = null;
    user.banReason = null;

    const savedUser = await this.userRepository.save(user);

    await this.logAudit(
      adminId,
      AuditAction.USER_UNBANNED,
      userId,
      'User unbanned',
      null,
      req,
    );

    return savedUser;
  }

  async suspendUser(
    userId: string,
    adminId: string,
    suspendDto: SuspendUserDto,
    req?: Request,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const suspendedUntil = new Date(suspendDto.suspendedUntil);
    if (suspendedUntil <= new Date()) {
      throw new BadRequestException('Suspension date must be in the future');
    }

    // Prevent suspending admins - load roles if not already loaded
    let userWithRoles = user;
    if (!user.roles || user.roles.length === 0) {
      userWithRoles = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['roles'],
      });
    }
    const userRoles = userWithRoles?.roles || [];
    const isAdmin = userRoles.some((role) => role.name === 'admin');
    if (isAdmin) {
      throw new ForbiddenException('Cannot suspend admin users');
    }

    user.suspendedUntil = suspendedUntil;
    user.suspendedAt = new Date();
    user.suspendedBy = adminId;
    user.suspensionReason = suspendDto.reason || null;

    const savedUser = await this.userRepository.save(user);

    await this.logAudit(
      adminId,
      AuditAction.USER_SUSPENDED,
      userId,
      suspendDto.reason || 'User suspended',
      {
        reason: suspendDto.reason,
        suspendedUntil: suspendedUntil.toISOString(),
      },
      req,
    );

    return savedUser;
  }

  async unsuspendUser(
    userId: string,
    adminId: string,
    req?: Request,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.suspendedUntil || user.suspendedUntil <= new Date()) {
      throw new BadRequestException('User is not suspended');
    }

    user.suspendedUntil = null;
    user.suspendedAt = null;
    user.suspendedBy = null;
    user.suspensionReason = null;

    const savedUser = await this.userRepository.save(user);

    await this.logAudit(
      adminId,
      AuditAction.USER_UNSUSPENDED,
      userId,
      'User unsuspended',
      null,
      req,
    );

    return savedUser;
  }

  async verifyUser(
    userId: string,
    adminId: string,
    req?: Request,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.isVerified = true;
    user.verifiedAt = new Date();
    user.verifiedBy = adminId;

    const savedUser = await this.userRepository.save(user);

    await this.logAudit(
      adminId,
      AuditAction.USER_VERIFIED,
      userId,
      'User verified',
      null,
      req,
    );

    return savedUser;
  }

  async unverifyUser(
    userId: string,
    adminId: string,
    req?: Request,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.isVerified = false;
    user.verifiedAt = null;
    user.verifiedBy = null;

    const savedUser = await this.userRepository.save(user);

    await this.logAudit(
      adminId,
      AuditAction.USER_UNVERIFIED,
      userId,
      'User unverified',
      null,
      req,
    );

    return savedUser;
  }

  async bulkAction(
    bulkDto: BulkActionDto,
    adminId: string,
    req?: Request,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const { userIds, action, reason, suspendedUntil } = bulkDto;

    if (userIds.length === 0) {
      throw new BadRequestException('No user IDs provided');
    }

    if (userIds.length > 100) {
      throw new BadRequestException('Maximum 100 users per bulk action');
    }

    const users = await this.userRepository.find({
      where: { id: In(userIds) },
      relations: ['roles'],
    });

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const user of users) {
      try {
        const userRoles = user.roles || [];
        const isAdmin = userRoles.some((role) => role.name === 'admin');

        switch (action) {
          case BulkActionType.BAN:
            if (isAdmin) {
              errors.push(`Cannot ban admin user: ${user.email}`);
              failed++;
              continue;
            }
            user.isBanned = true;
            user.bannedAt = new Date();
            user.bannedBy = adminId;
            user.banReason = reason || null;
            break;

          case BulkActionType.UNBAN:
            user.isBanned = false;
            user.bannedAt = null;
            user.bannedBy = null;
            user.banReason = null;
            break;

          case BulkActionType.SUSPEND:
            if (isAdmin) {
              errors.push(`Cannot suspend admin user: ${user.email}`);
              failed++;
              continue;
            }
            if (!suspendedUntil) {
              errors.push(`Suspension date required for user: ${user.email}`);
              failed++;
              continue;
            }
            const suspendDate = new Date(suspendedUntil);
            if (suspendDate <= new Date()) {
              errors.push(`Invalid suspension date for user: ${user.email}`);
              failed++;
              continue;
            }
            user.suspendedUntil = suspendDate;
            user.suspendedAt = new Date();
            user.suspendedBy = adminId;
            user.suspensionReason = reason || null;
            break;

          case BulkActionType.UNSUSPEND:
            user.suspendedUntil = null;
            user.suspendedAt = null;
            user.suspendedBy = null;
            user.suspensionReason = null;
            break;

          case BulkActionType.VERIFY:
            user.isVerified = true;
            user.verifiedAt = new Date();
            user.verifiedBy = adminId;
            break;

          case BulkActionType.UNVERIFY:
            user.isVerified = false;
            user.verifiedAt = null;
            user.verifiedBy = null;
            break;

          case BulkActionType.DELETE:
            if (isAdmin) {
              errors.push(`Cannot delete admin user: ${user.email}`);
              failed++;
              continue;
            }
            await this.userRepository.remove(user);
            success++;
            continue;
        }

        await this.userRepository.save(user);
        success++;
      } catch (error) {
        errors.push(`Failed to process user ${user.email}: ${error.message}`);
        failed++;
      }
    }

    const bulkSeverity =
      userIds.length >= 25 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM;

    await this.logAudit(
      adminId,
      AuditAction.BULK_ACTION,
      null,
      `Bulk action: ${action} on ${userIds.length} users`,
      {
        action,
        userIds,
        count: userIds.length,
        success,
        failed,
        reason,
      },
      req,
      bulkSeverity,
    );

    return { success, failed, errors };
  }

  async getUserStatistics(
    adminId: string,
    req?: Request,
  ): Promise<{
    total: number;
    active: number;
    banned: number;
    suspended: number;
    verified: number;
    unverified: number;
    byRole: Record<string, number>;
    recentRegistrations: number;
  }> {
    const total = await this.userRepository.count();
    const banned = await this.userRepository.count({ where: { isBanned: true } });
    const verified = await this.userRepository.count({ where: { isVerified: true } });
    const unverified = await this.userRepository.count({ where: { isVerified: false } });

    const now = new Date();
    const suspended = await this.userRepository
      .createQueryBuilder('user')
      .where('user.suspendedUntil > :now', { now })
      .getCount();

    const active = total - banned - suspended;

    // Recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRegistrations = await this.userRepository
      .createQueryBuilder('user')
      .where('user.createdAt >= :date', { date: sevenDaysAgo })
      .getCount();

    // Count by role
    const usersWithRoles = await this.userRepository.find({
      relations: ['roles'],
    });

    const byRole: Record<string, number> = {};
    usersWithRoles.forEach((user) => {
      const roles = user.roles || [];
      if (roles.length === 0) {
        byRole['no-role'] = (byRole['no-role'] || 0) + 1;
      } else {
        roles.forEach((role) => {
          byRole[role.name] = (byRole[role.name] || 0) + 1;
        });
      }
    });

    await this.logAudit(
      adminId,
      AuditAction.USER_VIEWED,
      null,
      'Viewed user statistics',
      null,
      req,
      AuditSeverity.LOW,
    );

    return {
      total,
      active,
      banned,
      suspended,
      verified,
      unverified,
      byRole,
      recentRegistrations,
    };
  }

  async getUserActivity(
    userId: string,
    adminId: string,
    req?: Request,
  ): Promise<{
    user: User;
    recentLogins: number;
    lastActive: Date | null;
    auditHistory: AuditLog[];
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get audit history for this user
    const auditHistory = await this.auditLogRepository.find({
      where: { targetUserId: userId },
      order: { createdAt: 'DESC' },
      take: 50,
      relations: ['actorUser'],
    });

    await this.logAudit(
      adminId,
      AuditAction.USER_VIEWED,
      userId,
      'Viewed user activity',
      null,
      req,
      AuditSeverity.LOW,
    );

    // This would need to be implemented based on your session/login tracking
    // For now, returning placeholder values
    return {
      user,
      recentLogins: 0, // TODO: Implement based on session tracking
      lastActive: user.updatedAt || null,
      auditHistory,
    };
  }

  async getAuditLogs(
    filters: AuditLogFilters,
    adminId: string,
    req?: Request,
  ): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.AUDIT_LOG_VIEWED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.LOW,
      details: 'Viewed audit logs',
      metadata: { filters },
      req,
    });

    return await this.auditLogService.searchAuditLogs(filters);
  }

  async exportAuditLogs(
    filters: AuditLogFilters,
    format: 'csv' | 'json',
    adminId: string,
    req?: Request,
  ) {
    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.AUDIT_LOG_EXPORTED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: 'Exported audit logs',
      metadata: { filters, format },
      req,
    });

    await this.safeLogDataAccess({
      actorUserId: adminId,
      action: DataAccessAction.EXPORT,
      resourceType: 'audit_logs',
      details: 'Exported audit logs',
      metadata: { filters, format },
      req,
    });

    return await this.auditLogService.exportAuditLogs(filters, format);
  }

  async exportUserData(userId: string, adminId: string, req?: Request) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const [sessions, transfersSent, transfersReceived, messages] = await Promise.all([
      this.sessionRepository.find({ where: { userId } }),
      this.transferRepository.find({ where: { senderId: userId } }),
      this.transferRepository.find({ where: { recipientId: userId } }),
      this.messageRepository.find({ where: { authorId: userId } }),
    ]);

    const auditLogs = await this.auditLogRepository.find({
      where: [{ actorUserId: userId }, { targetUserId: userId }],
      order: { createdAt: 'DESC' },
      take: 500,
    });

    const dataAccessLogs = await this.auditLogService.getDataAccessLogsForUser(userId);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.DATA_EXPORT,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.HIGH,
      targetUserId: userId,
      details: 'GDPR data export',
      metadata: { userId },
      req,
    });

    await this.safeLogDataAccess({
      actorUserId: adminId,
      targetUserId: userId,
      action: DataAccessAction.EXPORT,
      resourceType: 'user_data_export',
      resourceId: userId,
      details: 'GDPR data export',
      req,
    });

    return {
      user,
      sessions,
      transfersSent,
      transfersReceived,
      messages,
      auditLogs,
      dataAccessLogs,
      exportedAt: new Date().toISOString(),
    };
  }

  async logImpersonationStart(
    adminId: string,
    targetUserId: string,
    req?: Request,
  ): Promise<void> {
    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      targetUserId,
      action: AuditAction.IMPERSONATION_STARTED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.HIGH,
      details: 'Impersonation started',
      req,
    });
  }
}
