import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, In } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import {
  AuditLog,
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { GetUsersDto, UserFilterStatus } from '../dto/get-users.dto';
import { GetRoomsDto, RoomFilterStatus } from '../dto/get-rooms.dto';
import { BanUserDto } from '../dto/ban-user.dto';
import { SuspendUserDto } from '../dto/suspend-user.dto';
import { BulkActionDto, BulkActionType } from '../dto/bulk-action.dto';
import { DeleteUserDto } from '../dto/delete-user.dto';
import { Request } from 'express';
import { AuditLogService, AuditLogFilters } from './audit-log.service';
import { DataAccessAction } from '../entities/data-access-log.entity';
import { Transfer } from '../../transfer/entities/transfer.entity';
import { ADMIN_STREAM_EVENTS } from '../gateways/admin-event-stream.gateway';
import { Session } from '../../sessions/entities/session.entity';
import { Message } from '../../message/entities/message.entity';
import { Room, RoomType } from '../../room/entities/room.entity';
import { RoomMember } from '../../room/entities/room-member.entity';
import { RoomPayment, PaymentStatus } from '../../room/entities/room-payment.entity';
import { TransferBalanceService } from '../../transfer/services/transfer-balance.service';
import { UserRole } from '../../roles/entities/role.entity';
import { PlatformConfig } from '../entities/platform-config.entity';
import { UpdateConfigDto } from '../dto/update-config.dto';
import { RedisService } from '../../redis/redis.service';
import { GetRevenueAnalyticsDto, RevenuePeriod } from '../dto/get-revenue-analytics.dto';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { LeaderboardCategory, LeaderboardPeriod } from '../../leaderboard/leaderboard.interface';
import { ResetLeaderboardDto } from '../dto/reset-leaderboard.dto';
import { SetPinnedDto } from '../dto/set-pinned.dto';

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
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomMember)
    private readonly roomMemberRepository: Repository<RoomMember>,
    @InjectRepository(RoomPayment)
    private readonly roomPaymentRepository: Repository<RoomPayment>,
    @InjectRepository(PlatformConfig)
    private readonly platformConfigRepository: Repository<PlatformConfig>,
    private readonly auditLogService: AuditLogService,
    private readonly transferBalanceService: TransferBalanceService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly leaderboardService: LeaderboardService,
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

    this.eventEmitter.emit(ADMIN_STREAM_EVENTS.USER_BANNED, {
      type: 'user.banned',
      timestamp: new Date().toISOString(),
      entity: {
        userId: user.id,
        email: user.email,
        bannedBy: adminId,
        reason: banDto.reason ?? undefined,
      },
    });

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
    });
  }

  async deleteUser(
    userId: string,
    dto: DeleteUserDto,
    adminId: string,
    force: boolean = false,
    req?: Request,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verify confirmEmail
    if (dto.confirmEmail !== user.email) {
      throw new BadRequestException('Confirmation email does not match user email');
    }

    // Check balance
    const balance = await this.transferBalanceService.getBalance(userId);
    if (balance > 0 && !force) {
      throw new ConflictException(
        `User has a non-zero balance (${balance}). Funds must be withdrawn before deletion unless 'force' is used.`,
      );
    }

    // GDPR anonymization and soft delete
    const uuid = userId.split('-')[0];
    const originalEmail = user.email;
    const originalUsername = user.username;

    user.email = `deleted_${uuid}@deleted.local`;
    user.username = `[deleted]`;
    user.isBanned = true;
    user.banReason = `User deleted by admin ${adminId}: ${dto.reason}`;
    user.deletedAt = new Date();

    await this.userRepository.save(user);

    // Soft delete messages
    await this.messageRepository.update(
      { author: { id: userId } as any },
      {
        content: '[message deleted]',
        isDeleted: true,
        deletedAt: new Date(),
      },
    );

    // Handle rooms
    const ownedRooms = await this.roomRepository.find({
      where: { ownerId: userId },
    });

    const platformAdminId = process.env.PLATFORM_ADMIN_ID;

    for (const room of ownedRooms) {
      const memberCount = await this.roomMemberRepository.count({
        where: { roomId: room.id },
      });

      if (memberCount < 2) {
        // Close room
        await this.roomRepository.update(room.id, {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
        });
      } else if (platformAdminId) {
        // Transfer to platform admin
        await this.roomRepository.update(room.id, {
          ownerId: platformAdminId,
        });
      } else {
        // If no platform admin configured, we might have to close it or handle differently
        // For now, let's close it to be safe if no platform admin is found
        await this.roomRepository.update(room.id, {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
        });
      }
    }

    // Invalidate sessions
    await this.sessionRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );

    // Log audit
    await this.logAudit(
      adminId,
      AuditAction.USER_DELETED,
      userId,
      `User deleted (GDPR compliant). Reason: ${dto.reason}`,
      { originalEmail, originalUsername, forced: force },
      req,
      AuditSeverity.HIGH,
    );

    return { message: 'User account successfully deleted and anonymized' };
  }

  async getConfigs(): Promise<PlatformConfig[]> {
    return await this.platformConfigRepository.find({
      order: { key: 'ASC' },
    });
  }

  async updateConfig(
    key: string,
    dto: UpdateConfigDto,
    adminId: string,
    req?: Request,
  ): Promise<PlatformConfig> {
    const config = await this.platformConfigRepository.findOne({ where: { key } });

    if (!config) {
      throw new NotFoundException(`Configuration with key ${key} not found`);
    }

    const oldValue = config.value;
    const oldValueString = JSON.stringify(oldValue);
    const newValueString = JSON.stringify(dto.value);

    // Update config
    config.value = dto.value;
    config.updatedBy = adminId;
    const saved = await this.platformConfigRepository.save(config);

    // Invalidate Redis cache
    await this.redisService.del(`platform_config:${key}`);

    // Audit log
    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.PLATFORM_CONFIG_UPDATED,
      eventType: AuditEventType.SYSTEM,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.HIGH,
      resourceType: 'platform_config',
      resourceId: key,
      details: `Config ${key} updated: ${oldValueString} -> ${newValueString}. Reason: ${dto.reason}`,
      metadata: {
        key,
        oldValue,
        newValue: dto.value,
        reason: dto.reason,
      },
      req,
    });

    return saved;
  }

  async getConfigValue<T>(key: string, defaultValue: T): Promise<T> {
    const cacheKey = `platform_config:${key}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as T;
    }

    const config = await this.platformConfigRepository.findOne({ where: { key } });
    if (!config) {
      return defaultValue;
    }

    await this.redisService.set(cacheKey, JSON.stringify(config.value), 3600); // 1 hour cache
    return config.value as T;
  }

  async getRevenueAnalytics(
    query: GetRevenueAnalyticsDto,
    adminId: string,
    req?: Request,
  ) {
    const { period, startDate, endDate, chain } = query;

    const start = new Date();
    const end = new Date();

    if (period === RevenuePeriod.CUSTOM && startDate && endDate) {
      start.setTime(new Date(startDate).getTime());
      end.setTime(new Date(endDate).getTime());
    } else {
      switch (period) {
        case RevenuePeriod.DAY:
          start.setHours(0, 0, 0, 0);
          break;
        case RevenuePeriod.WEEK:
          start.setDate(start.getDate() - 7);
          break;
        case RevenuePeriod.MONTH:
          start.setMonth(start.getMonth() - 1);
          break;
        case RevenuePeriod.YEAR:
          start.setFullYear(start.getFullYear() - 1);
          break;
      }
    }

    // Query room payments
    const roomPaymentsQuery = this.roomPaymentRepository
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.createdAt BETWEEN :start AND :end', { start, end });

    if (chain) {
      roomPaymentsQuery.andWhere('payment.blockchainNetwork = :chain', {
        chain,
      });
    }

    const roomPayments = await roomPaymentsQuery.getMany();

    // Query tips (messages of type tip)
    const tipsQuery = this.messageRepository
      .createQueryBuilder('message')
      .where("message.type = 'tip'")
      .andWhere('message.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('message.createdAt BETWEEN :start AND :end', { start, end });

    const tips = await tipsQuery.getMany();

    // Aggregation
    let totalRevenue = 0;
    const byType = {
      tips: 0,
      roomEntry: 0,
    };
    const byChain: Record<string, number> = {};
    const byDayMap = new Map<string, number>();

    // Process room payments
    for (const payment of roomPayments) {
      const fee = parseFloat(payment.platformFee);
      totalRevenue += fee;
      byType.roomEntry += fee;

      const network = payment.blockchainNetwork || 'unknown';
      byChain[network] = (byChain[network] || 0) + fee;

      const dateStr = payment.createdAt.toISOString().split('T')[0];
      byDayMap.set(dateStr, (byDayMap.get(dateStr) || 0) + fee);
    }

    // Process tips
    for (const tip of tips) {
      const fee = parseFloat(tip.metadata?.platformFee || '0');
      const network = tip.metadata?.blockchainNetwork || 'stellar'; // Default for tips if not specified

      if (!chain || network === chain) {
        totalRevenue += fee;
        byType.tips += fee;
        byChain[network] = (byChain[network] || 0) + fee;

        const dateStr = tip.createdAt.toISOString().split('T')[0];
        byDayMap.set(dateStr, (byDayMap.get(dateStr) || 0) + fee);
      }
    }

    const byDay = Array.from(byDayMap.entries())
      .map(([date, revenue]) => ({ date, revenue: revenue.toFixed(8) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalTransactionCount = roomPayments.length + tips.length;
    const averageFeePerTransaction =
      totalTransactionCount > 0
        ? (totalRevenue / totalTransactionCount).toFixed(8)
        : '0.00000000';

    const response = {
      totalRevenue: totalRevenue.toFixed(8),
      byType: {
        tips: byType.tips.toFixed(8),
        roomEntry: byType.roomEntry.toFixed(8),
      },
      byChain: Object.fromEntries(
        Object.entries(byChain).map(([k, v]) => [k, v.toFixed(8)]),
      ),
      byDay,
      transactionCount: totalTransactionCount,
      averageFeePerTransaction,
    };

    await this.logAudit(
      adminId,
      AuditAction.USER_VIEWED,
      null,
      'Viewed revenue analytics',
      { query },
      req,
      AuditSeverity.LOW,
    );

    return response;
  }

  async getLeaderboardTypes() {
    return Object.values(LeaderboardCategory);
  }

  async getLeaderboardEntries(
    type: LeaderboardCategory,
    query: { period?: LeaderboardPeriod; roomId?: string; page?: number; limit?: number },
  ) {
    return await this.leaderboardService.getTopUsers({
      category: type,
      timeframe: query.period || LeaderboardPeriod.ALL_TIME,
      roomId: query.roomId,
      limit: query.limit || 50,
      offset: ((query.page || 1) - 1) * (query.limit || 50),
    });
  }

  async resetLeaderboard(
    type: LeaderboardCategory,
    period: LeaderboardPeriod,
    dto: ResetLeaderboardDto,
    adminId: string,
    req?: Request,
  ) {
    await this.leaderboardService.adminResetLeaderboard(type, period, {
      reason: dto.reason,
      snapshotBeforeReset: dto.snapshotBeforeReset,
      adminId,
      roomId: dto.roomId,
    });

    await this.logAudit(
      adminId,
      AuditAction.BULK_ACTION,
      null,
      `Reset leaderboard: ${type} (${period})`,
      { type, period, dto },
      req,
      AuditSeverity.HIGH,
    );

    return { message: `Leaderboard ${type} (${period}) reset successfully` };
  }

  async getLeaderboardHistory(page: number = 1, limit: number = 20) {
    const snapshots = await this.leaderboardService.getHistory(limit, (page - 1) * limit);
    return snapshots;
  }

  async setLeaderboardPinned(
    dto: SetPinnedDto,
    adminId: string,
    req?: Request,
  ) {
    await this.leaderboardService.setPinnedStatus(
      dto.userId,
      dto.category,
      dto.period,
      dto.isPinned,
      dto.roomId,
    );

    await this.logAudit(
      adminId,
      AuditAction.BULK_ACTION,
      dto.userId,
      `Set user pinned status on leaderboard: ${dto.isPinned}`,
      { dto },
      req,
      AuditSeverity.MEDIUM,
    );

    return { message: `User pinned status updated successfully` };
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Return all sessions (active and inactive) for forensic investigation
    return await this.sessionRepository.find({
      where: { userId },
      order: { lastActivity: 'DESC' },
    });
  }

  async terminateSession(
    userId: string,
    sessionId: string,
    adminId: string,
    req?: Request,
  ): Promise<{ message: string }> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find and verify session belongs to user
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Terminate the session
    await this.sessionRepository.revokeSession(sessionId);

    // Log audit action
    await this.logAudit(
      adminId,
      AuditAction.AUTH_LOGOUT,
      userId,
      `Terminated user session: ${sessionId}`,
      {
        sessionId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        deviceName: session.deviceName,
      },
      req,
      AuditSeverity.MEDIUM,
      'session',
      sessionId,
    );

    return { message: 'Session terminated successfully' };
  }

  async terminateAllUserSessions(
    userId: string,
    adminId: string,
    req?: Request,
  ): Promise<{ message: string; terminatedCount: number }> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get active sessions to count them
    const activeSessions = await this.sessionRepository.find({
      where: { userId, isActive: true },
    });

    const terminatedCount = activeSessions.length;

    // Terminate all sessions for the user
    await this.sessionRepository.revokeAllUserSessions(userId);

    // Log audit action
    await this.logAudit(
      adminId,
      AuditAction.AUTH_LOGOUT,
      userId,
      `Terminated all user sessions (${terminatedCount} sessions)`,
      {
        terminatedCount,
        sessions: activeSessions.map((s) => ({
          sessionId: s.id,
          ipAddress: s.ipAddress,
          deviceName: s.deviceName,
        })),
      },
      req,
      AuditSeverity.MEDIUM,
      'user',
      userId,
    );

    return { message: 'All sessions terminated successfully', terminatedCount };
  }

  async getRooms(
    query: GetRoomsDto,
  ): Promise<{
    rooms: Array<{
      id: string;
      name: string;
      type: RoomType;
      status: string;
      owner: { id: string; username: string } | null;
      memberCount: number;
      messageCount: number;
      entryFee: string;
      totalFeesCollected: string;
      createdAt: Date;
      expiresAt: Date | null;
      isFlagged: boolean;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      search,
      type,
      status,
      ownerId,
      minMembers,
      maxMembers,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const skip = (page - 1) * limit;
    const queryBuilder = this.roomRepository.createQueryBuilder('room');

    // Search on name and description
    if (search) {
      queryBuilder.andWhere(
        '(room.name ILIKE :search OR room.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Filter by type
    if (type) {
      queryBuilder.andWhere('room.roomType = :type', { type });
    }

    // Filter by owner
    if (ownerId) {
      queryBuilder.andWhere('room.ownerId = :ownerId', { ownerId });
    }

    // Filter by member count
    if (minMembers !== undefined) {
      queryBuilder.andWhere('room.memberCount >= :minMembers', { minMembers });
    }

    if (maxMembers !== undefined) {
      queryBuilder.andWhere('room.memberCount <= :maxMembers', { maxMembers });
    }

    // Filter by date range
    if (startDate) {
      queryBuilder.andWhere('room.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      queryBuilder.andWhere('room.createdAt <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    // Filter by status
    if (status) {
      switch (status) {
        case RoomFilterStatus.ACTIVE:
          queryBuilder.andWhere(
            'room.isActive = :isActive AND room.isDeleted = :isDeleted AND room.isExpired = :isExpired',
            { isActive: true, isDeleted: false, isExpired: false },
          );
          break;
        case RoomFilterStatus.CLOSED:
          queryBuilder.andWhere('room.isExpired = :isExpired', { isExpired: true });
          break;
        case RoomFilterStatus.FLAGGED:
          queryBuilder.andWhere('room.warningNotificationSent = :flagged', {
            flagged: true,
          });
          break;
        case RoomFilterStatus.DELETED:
          queryBuilder.andWhere('room.isDeleted = :isDeleted', { isDeleted: true });
          break;
      }
    }

    // Load relations
    queryBuilder.leftJoinAndSelect('room.owner', 'owner');

    // Apply sorting
    const orderColumn = `room.${sortBy}`;
    queryBuilder.orderBy(orderColumn, sortOrder);

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const [rooms, total] = await queryBuilder.getManyAndCount();

    // Get message counts and total fees for each room
    const roomsWithDetails = await Promise.all(
      rooms.map(async (room) => {
        // Count messages in room
        const messageCount = await this.messageRepository.count({
          where: { roomId: room.id },
        });

        // Calculate total fees collected
        const feeResult = await this.roomPaymentRepository
          .createQueryBuilder('payment')
          .select('SUM(CAST(payment.amount as DECIMAL))', 'total')
          .where('payment.roomId = :roomId', { roomId: room.id })
          .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
          .getRawOne();

        const totalFeesCollected = feeResult?.total || '0';

        return {
          id: room.id,
          name: room.name,
          type: room.roomType,
          status: this.determineRoomStatus(room),
          owner: room.owner
            ? { id: room.owner.id, username: room.owner.username }
            : null,
          memberCount: room.memberCount,
          messageCount,
          entryFee: room.entryFee,
          totalFeesCollected,
          createdAt: room.createdAt,
          expiresAt: room.expiryTimestamp
            ? new Date(room.expiryTimestamp)
            : null,
          isFlagged: room.warningNotificationSent,
        };
      }),
    );

    return {
      rooms: roomsWithDetails,
      total,
      page,
      limit,
    };
  }

  private determineRoomStatus(room: Room): string {
    if (room.isDeleted) return RoomFilterStatus.DELETED;
    if (room.warningNotificationSent) return RoomFilterStatus.FLAGGED;
    if (room.isExpired) return RoomFilterStatus.CLOSED;
    if (room.isActive) return RoomFilterStatus.ACTIVE;
    return 'unknown';
  }
}
