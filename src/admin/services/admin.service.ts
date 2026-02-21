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
import { Repository, In, MoreThanOrEqual, LessThan, Between } from 'typeorm';
import { randomBytes } from 'crypto';
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
import { GetRoomDetailsDto } from '../dto/get-room-details.dto';
import { BanUserDto } from '../dto/ban-user.dto';
import { BanUserDto, BanType } from '../dto/ban-user.dto';
import { UnbanUserDto } from '../dto/unban-user.dto';
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
import {
  RoomPayment,
  PaymentStatus,
} from '../../room/entities/room-payment.entity';
import { TransferBalanceService } from '../../transfer/services/transfer-balance.service';
import { UserRole } from '../../roles/entities/role.entity';
import { PlatformConfig } from '../entities/platform-config.entity';
import { UpdateConfigDto } from '../dto/update-config.dto';
import { RedisService } from '../../redis/redis.service';
import {
  GetRevenueAnalyticsDto,
  RevenuePeriod,
} from '../dto/get-revenue-analytics.dto';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import {
  LeaderboardCategory,
  LeaderboardPeriod,
} from '../../leaderboard/leaderboard.interface';
import { ResetLeaderboardDto } from '../dto/reset-leaderboard.dto';
import { SetPinnedDto } from '../dto/set-pinned.dto';
import {
  GetOverviewAnalyticsDto,
  AnalyticsPeriod,
} from '../dto/get-overview-analytics.dto';
import { CacheService } from '../../cache/cache.service';
import { SessionService } from '../../sessions/services/sessions.service';
import { MessagesGateway } from '../../message/gateways/messages.gateway';
import { NotificationGateway } from '../../notifications/gateways/notification.gateway';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '../../queue/queue.constants';

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
    private readonly cacheService: CacheService,
    private readonly sessionService: SessionService,
    private readonly messagesGateway: MessagesGateway,
    private readonly notificationGateway: NotificationGateway,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
  ) {}

  async getTransactions(
    query: any,
    adminId: string,
    req?: Request,
  ): Promise<{ transactions: any[]; total: number; page: number; limit: number }> {
    const {
      type,
      status,
      userId,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      chainId,
      page = 1,
      limit = 20,
    } = query;

    const skip = (page - 1) * limit;

    // Fetch relevant records per type
    const results: any[] = [];

    // 1) P2P transfers
    if (!type || type === 'p2p_transfer') {
      const transferQ = this.transferRepository.createQueryBuilder('t');
      if (status) transferQ.andWhere('t.status = :status', { status });
      if (userId) transferQ.andWhere('(t.senderId = :userId OR t.recipientId = :userId)', { userId });
      if (chainId) transferQ.andWhere('t.blockchainNetwork = :chainId', { chainId });
      if (startDate) transferQ.andWhere('t.createdAt >= :startDate', { startDate: new Date(startDate) });
      if (endDate) transferQ.andWhere('t.createdAt <= :endDate', { endDate: new Date(endDate) });
      if (minAmount) transferQ.andWhere('CAST(t.amount AS DECIMAL) >= :minAmount', { minAmount });
      if (maxAmount) transferQ.andWhere('CAST(t.amount AS DECIMAL) <= :maxAmount', { maxAmount });
      transferQ.orderBy('t.createdAt', 'DESC');
      const transfers = await transferQ.getMany();

      for (const t of transfers) {
        results.push({
          txHash: t.transactionHash || null,
          type: 'p2p_transfer',
          fromUser: t.senderId,
          toUser: t.recipientId,
          amount: t.amount,
          platformFee: null,
          netAmount: t.amount,
          chain: t.blockchainNetwork,
          status: t.status,
          blockNumber: null,
          confirmedAt: t.completedAt || null,
          createdAt: t.createdAt,
        });
      }
    }

    // 2) Room payments (room_entry)
    if (!type || type === 'room_entry') {
      const rpQ = this.roomPaymentRepository.createQueryBuilder('p').leftJoinAndSelect('p.room', 'room');
      if (status) rpQ.andWhere('p.status = :status', { status });
      if (userId) rpQ.andWhere('p.userId = :userId', { userId });
      if (chainId) rpQ.andWhere('p.blockchainNetwork = :chainId', { chainId });
      if (startDate) rpQ.andWhere('p.createdAt >= :startDate', { startDate: new Date(startDate) });
      if (endDate) rpQ.andWhere('p.createdAt <= :endDate', { endDate: new Date(endDate) });
      if (minAmount) rpQ.andWhere('CAST(p.amount AS DECIMAL) >= :minAmount', { minAmount });
      if (maxAmount) rpQ.andWhere('CAST(p.amount AS DECIMAL) <= :maxAmount', { maxAmount });
      rpQ.orderBy('p.createdAt', 'DESC');
      const payments = await rpQ.getMany();

      for (const p of payments) {
        results.push({
          txHash: p.transactionHash || null,
          type: 'room_entry',
          fromUser: p.userId,
          toUser: p.room ? (p.room.ownerId || null) : null,
          amount: p.amount,
          platformFee: p.platformFee,
          netAmount: p.creatorAmount,
          chain: p.blockchainNetwork,
          status: p.status,
          blockNumber: null,
          confirmedAt: p.refundedAt || p.updatedAt || null,
          createdAt: p.createdAt,
        });
      }
    }

    // 3) Tips (messages of type TIP)
    if (!type || type === 'tip') {
      const msgQ = this.messageRepository.createQueryBuilder('m').leftJoinAndSelect('m.author', 'author');
      msgQ.where("m.type = 'tip'");
      if (userId) msgQ.andWhere('(m.authorId = :userId OR (m.metadata->>\'toUser\') = :userId)', { userId });
      if (startDate) msgQ.andWhere('m.createdAt >= :startDate', { startDate: new Date(startDate) });
      if (endDate) msgQ.andWhere('m.createdAt <= :endDate', { endDate: new Date(endDate) });
      if (chainId) msgQ.andWhere("(m.metadata->> 'blockchainNetwork') = :chainId", { chainId });
      msgQ.orderBy('m.createdAt', 'DESC');
      const tips = await msgQ.getMany();

      for (const t of tips) {
        const amount = t.metadata?.amount || null;
        const fee = t.metadata?.platformFee || null;
        results.push({
          txHash: t.metadata?.txHash || null,
          type: 'tip',
          fromUser: t.authorId,
          toUser: t.metadata?.toUser || null,
          amount,
          platformFee: fee,
          netAmount: amount ? (parseFloat(amount) - parseFloat(fee || '0')).toString() : null,
          chain: t.metadata?.blockchainNetwork || null,
          status: t.metadata?.status || (t.metadata?.txHash ? 'confirmed' : 'pending'),
          blockNumber: t.metadata?.blockNumber || null,
          confirmedAt: t.metadata?.confirmedAt ? new Date(t.metadata.confirmedAt) : null,
          createdAt: t.createdAt,
        });
      }
    }

    // 4) Withdrawals & refunds: attempt to include as room payments with refunded status or special transfer types
    // Refunds from room payments already included via status = 'refunded' if filter applied.

    // Sort merged results by createdAt desc
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = results.length;
    const pageItems = results.slice(skip, skip + limit);

    await this.logAudit(
      adminId,
      AuditAction.USER_VIEWED,
      null,
      `Viewed transactions (${pageItems.length})`,
      { filters: query },
      req,
      AuditSeverity.LOW,
    );

    await this.safeLogDataAccess({
      actorUserId: adminId,
      action: DataAccessAction.VIEW,
      resourceType: 'transactions',
      details: 'Viewed transactions ledger',
      metadata: { filters: query, count: pageItems.length },
      req,
    });

    return { transactions: pageItems, total, page, limit };
  }

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
      queryBuilder.andWhere('(user.email ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    // Status filter
    if (status && status !== UserFilterStatus.ALL) {
      if (status === UserFilterStatus.BANNED) {
        queryBuilder.andWhere('user.isBanned = :isBanned', { isBanned: true });
      } else if (status === UserFilterStatus.SUSPENDED) {
        queryBuilder.andWhere('user.suspendedUntil > :now', {
          now: new Date(),
        });
      }
    }

    // Boolean filters
    if (isBanned !== undefined) {
      queryBuilder.andWhere('user.isBanned = :isBanned', { isBanned });
    }

    if (isSuspended !== undefined) {
      if (isSuspended) {
        queryBuilder.andWhere('user.suspendedUntil > :now', {
          now: new Date(),
        });
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

  async getUserDetail(
    userId: string,
    adminId: string,
    req?: Request,
  ): Promise<User> {
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
    // Get admin user to check role
    const adminUser = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['roles'],
    });

    if (!adminUser) {
      throw new NotFoundException(`Admin user with ID ${adminId} not found`);
    }

    const adminRoles = adminUser.roles || [];
    const adminRoleNames = adminRoles.map((r) => r.name);
    const isSuperAdmin = adminRoleNames.includes(UserRole.SUPER_ADMIN);
    const isAdmin = adminRoleNames.includes(UserRole.ADMIN);

    // Get target user
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isBanned) {
      throw new BadRequestException('User is already banned');
    }

    // Check role-based permissions
    const userRoles = user.roles || [];
    const userRoleNames = userRoles.map((r) => r.name);
    const targetIsSuperAdmin = userRoleNames.includes(UserRole.SUPER_ADMIN);
    const targetIsAdmin = userRoleNames.includes(UserRole.ADMIN);

    // SUPER_ADMIN can ban ADMIN users; ADMIN can ban regular users; MODERATOR cannot ban
    if (targetIsSuperAdmin) {
      throw new ForbiddenException('Cannot ban super admin users');
    }
    const userRoles = userWithRoles?.roles || [];
    const isAdmin = userRoles.some(
      (role) =>
        role.name === UserRole.ADMIN || role.name === UserRole.SUPER_ADMIN,
    );
    if (isAdmin) {
      throw new ForbiddenException('Cannot ban admin users');

    if (targetIsAdmin && !isSuperAdmin) {
      throw new ForbiddenException(
        'Only super admins can ban admin users',
      );
    }

    // Validate temporary ban expiration
    if (banDto.type === BanType.TEMPORARY) {
      if (!banDto.expiresAt) {
        throw new BadRequestException(
          'expiresAt is required for temporary bans',
        );
      }
      const expiresAt = new Date(banDto.expiresAt);
      if (expiresAt <= new Date()) {
        throw new BadRequestException(
          'expiresAt must be in the future',
        );
      }
      user.banExpiresAt = expiresAt;
    } else {
      user.banExpiresAt = null;
    }

    // Set ban fields
    user.isBanned = true;
    user.bannedAt = new Date();
    user.bannedBy = adminId;
    user.banReason = banDto.reason;

    const savedUser = await this.userRepository.save(user);

    // Invalidate all active JWT sessions for that user immediately
    try {
      await this.sessionService.revokeAllSessions(userId);
      this.logger.log(`Revoked all sessions for banned user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to revoke sessions for user ${userId}:`,
        error,
      );
    }

    // Kick the user from all active WebSocket connections
    try {
      // Disconnect from messages gateway
      const userSockets = (this.messagesGateway as any).userSockets?.get(
        userId,
      );
      if (userSockets) {
        userSockets.forEach((socketId: string) => {
          (this.messagesGateway as any).server
            .to(socketId)
            .emit('user-banned', {
              reason: banDto.reason,
              type: banDto.type,
              expiresAt: user.banExpiresAt,
            });
          (this.messagesGateway as any).server.sockets.sockets
            .get(socketId)
            ?.disconnect(true);
        });
      }

      // Disconnect from notifications gateway
      const notificationSockets = (this.notificationGateway as any).userSockets?.get(
        userId,
      );
      if (notificationSockets) {
        notificationSockets.forEach((socketId: string) => {
          (this.notificationGateway as any).server
            .to(socketId)
            .emit('user-banned', {
              reason: banDto.reason,
              type: banDto.type,
              expiresAt: user.banExpiresAt,
            });
          (this.notificationGateway as any).server.sockets.sockets
            .get(socketId)
            ?.disconnect(true);
        });
      }
      this.logger.log(`Disconnected WebSocket connections for banned user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to disconnect WebSocket for user ${userId}:`,
        error,
      );
    }

    // Schedule auto-lift job for temporary bans
    if (banDto.type === BanType.TEMPORARY && user.banExpiresAt) {
      try {
        await this.notificationsQueue.add(
          'auto-unban-user',
          {
            userId,
            expiresAt: user.banExpiresAt,
          },
          {
            delay: user.banExpiresAt.getTime() - Date.now(),
            attempts: 1,
          },
        );
        this.logger.log(
          `Scheduled auto-unban job for user ${userId} at ${user.banExpiresAt}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to schedule auto-unban job for user ${userId}:`,
          error,
        );
      }
    }

    // Audit log entry with full metadata
    await this.logAudit(
      adminId,
      AuditAction.USER_BANNED,
      userId,
      `User banned: ${banDto.reason}`,
      {
        reason: banDto.reason,
        type: banDto.type,
        expiresAt: user.banExpiresAt?.toISOString(),
        adminRole: isSuperAdmin ? UserRole.SUPER_ADMIN : UserRole.ADMIN,
        targetUserRole: targetIsAdmin ? UserRole.ADMIN : UserRole.USER,
      },
      req,
      AuditSeverity.HIGH,
      'user',
      userId,
    );

    this.eventEmitter.emit(ADMIN_STREAM_EVENTS.USER_BANNED, {
      type: 'user.banned',
      timestamp: new Date().toISOString(),
      entity: {
        userId: user.id,
        email: user.email,
        bannedBy: adminId,
        reason: banDto.reason,
        type: banDto.type,
        expiresAt: user.banExpiresAt?.toISOString(),
      },
    });

    return savedUser;
  }

  async unbanUser(
    userId: string,
    adminId: string,
    unbanDto: UnbanUserDto,
    req?: Request,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.isBanned) {
      throw new BadRequestException('User is not banned');
    }

    // Clear ban fields
    user.isBanned = false;
    user.bannedAt = null;
    user.bannedBy = null;
    user.banReason = null;
    user.banExpiresAt = null;

    const savedUser = await this.userRepository.save(user);

    // Send notification to user if configured
    try {
      await this.notificationsQueue.add(
        'user-unbanned-notification',
        {
          userId,
          reason: unbanDto.reason,
          unbannedBy: adminId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      this.logger.log(`Queued unban notification for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue unban notification for user ${userId}:`,
        error,
      );
    }

    // Audit log entry with full metadata
    await this.logAudit(
      adminId,
      AuditAction.USER_UNBANNED,
      userId,
      `User unbanned: ${unbanDto.reason}`,
      {
        reason: unbanDto.reason,
        previousBanReason: user.banReason,
        previousBanType: user.banExpiresAt ? 'temporary' : 'permanent',
        previousBanExpiresAt: user.banExpiresAt?.toISOString(),
      },
      req,
      AuditSeverity.MEDIUM,
      'user',
      userId,
    );

    this.eventEmitter.emit(ADMIN_STREAM_EVENTS.USER_UNBANNED, {
      type: 'user.unbanned',
      timestamp: new Date().toISOString(),
      entity: {
        userId: user.id,
        email: user.email,
        unbannedBy: adminId,
        reason: unbanDto.reason,
      },
    });

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
    const isAdmin = userRoles.some(
      (role) =>
        role.name === UserRole.ADMIN || role.name === UserRole.SUPER_ADMIN,
    );
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
        const isAdmin = userRoles.some(
          (role) =>
            role.name === UserRole.ADMIN || role.name === UserRole.SUPER_ADMIN,
        );

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
    const banned = await this.userRepository.count({
      where: { isBanned: true },
    });
    const verified = await this.userRepository.count({
      where: { isVerified: true },
    });
    const unverified = await this.userRepository.count({
      where: { isVerified: false },
    });

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

    const [sessions, transfersSent, transfersReceived, messages] =
      await Promise.all([
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

    const dataAccessLogs =
      await this.auditLogService.getDataAccessLogsForUser(userId);

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
      throw new BadRequestException(
        'Confirmation email does not match user email',
      );
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
    const config = await this.platformConfigRepository.findOne({
      where: { key },
    });

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

    const config = await this.platformConfigRepository.findOne({
      where: { key },
    });
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
    query: {
      period?: LeaderboardPeriod;
      roomId?: string;
      page?: number;
      limit?: number;
    },
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
    const snapshots = await this.leaderboardService.getHistory(
      limit,
      (page - 1) * limit,
    );
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

  async getOverviewAnalytics(
    query: GetOverviewAnalyticsDto,
    adminId: string,
    req?: Request,
  ) {
    const { period = AnalyticsPeriod.MONTH } = query;
    const cacheKey = `admin:overview:${period}`;

    // Try to get from cache
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Returning cached overview analytics for period: ${period}`,
      );
      return cached;
    }

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    const previousPeriodStart = new Date();
    const previousPeriodEnd = new Date();

    switch (period) {
      case AnalyticsPeriod.DAY:
        startDate.setHours(0, 0, 0, 0);
        previousPeriodStart.setDate(startDate.getDate() - 1);
        previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd.setDate(startDate.getDate() - 1);
        previousPeriodEnd.setHours(23, 59, 59, 999);
        break;
      case AnalyticsPeriod.WEEK:
        startDate.setDate(startDate.getDate() - 7);
        previousPeriodStart.setDate(startDate.getDate() - 7);
        previousPeriodEnd.setTime(startDate.getTime() - 1);
        break;
      case AnalyticsPeriod.MONTH:
        startDate.setMonth(startDate.getMonth() - 1);
        previousPeriodStart.setMonth(startDate.getMonth() - 1);
        previousPeriodEnd.setTime(startDate.getTime() - 1);
        break;
      case AnalyticsPeriod.YEAR:
        startDate.setFullYear(startDate.getFullYear() - 1);
        previousPeriodStart.setFullYear(startDate.getFullYear() - 1);
        previousPeriodEnd.setTime(startDate.getTime() - 1);
        break;
    }

    // User metrics
    const [totalUsers, bannedUsers] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isBanned: true } }),
    ]);

    const newUsersThisPeriod = await this.userRepository.count({
      where: { createdAt: MoreThanOrEqual(startDate) },
    });

    const newUsersPreviousPeriod = await this.userRepository.count({
      where: {
        createdAt: Between(previousPeriodStart, previousPeriodEnd),
      },
    });

    // Active users (users with sessions in the period)
    const activeUsersThisPeriod = await this.sessionRepository
      .createQueryBuilder('session')
      .select('COUNT(DISTINCT session.userId)', 'count')
      .where('session.createdAt >= :startDate', { startDate })
      .getRawOne();

    const activeUserCount = parseInt(activeUsersThisPeriod?.count || '0', 10);

    // Calculate growth rate
    const growthRate =
      newUsersPreviousPeriod > 0
        ? (newUsersThisPeriod - newUsersPreviousPeriod) / newUsersPreviousPeriod
        : newUsersThisPeriod > 0
          ? 1
          : 0;

    // Room metrics
    const [totalRooms, activeRoomsThisPeriod, roomsCreatedThisPeriod] =
      await Promise.all([
        this.roomRepository.count({ where: { isDeleted: false } }),
        this.roomRepository
          .createQueryBuilder('room')
          .innerJoin('room.members', 'member')
          .where('room.isDeleted = :isDeleted', { isDeleted: false })
          .andWhere('member.lastActiveAt >= :startDate', { startDate })
          .select('COUNT(DISTINCT room.id)', 'count')
          .getRawOne()
          .then((result) => parseInt(result?.count || '0', 10)),
        this.roomRepository.count({
          where: {
            createdAt: MoreThanOrEqual(startDate),
            isDeleted: false,
          },
        }),
      ]);

    // Expired rooms in period
    const timedExpiredRooms = await this.roomRepository.count({
      where: {
        isExpired: true,
        updatedAt: MoreThanOrEqual(startDate),
      },
    });

    // Message metrics
    const messagesThisPeriod = await this.messageRepository.count({
      where: {
        createdAt: MoreThanOrEqual(startDate),
        isDeleted: false,
      },
    });

    const avgMessagesPerActiveUser =
      activeUserCount > 0 ? messagesThisPeriod / activeUserCount : 0;

    // Transaction metrics (room payments + tips)
    const roomPayments = await this.roomPaymentRepository
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.createdAt >= :startDate', { startDate })
      .getMany();

    const tips = await this.messageRepository
      .createQueryBuilder('message')
      .where("message.type = 'tip'")
      .andWhere('message.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('message.createdAt >= :startDate', { startDate })
      .getMany();

    let totalVolume = 0;
    let platformRevenue = 0;

    // Process room payments
    for (const payment of roomPayments) {
      const amount = parseFloat(payment.amount || '0');
      const fee = parseFloat(payment.platformFee || '0');
      totalVolume += amount;
      platformRevenue += fee;
    }

    // Process tips
    for (const tip of tips) {
      const amount = parseFloat(tip.metadata?.amount || '0');
      const fee = parseFloat(tip.metadata?.platformFee || '0');
      totalVolume += amount;
      platformRevenue += fee;
    }

    const transactionCount = roomPayments.length + tips.length;
    const avgTransactionValue =
      transactionCount > 0 ? totalVolume / transactionCount : 0;

    // Top rooms by activity
    const topRooms = await this.roomRepository
      .createQueryBuilder('room')
      .leftJoin('room.members', 'member')
      .leftJoinAndSelect('room.owner', 'owner')
      .where('room.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('member.lastActiveAt >= :startDate', { startDate })
      .select([
        'room.id',
        'room.name',
        'room.memberCount',
        'owner.id',
        'owner.username',
        'owner.email',
      ])
      .addSelect('COUNT(DISTINCT member.id)', 'activeMembers')
      .groupBy('room.id')
      .addGroupBy('owner.id')
      .orderBy('activeMembers', 'DESC')
      .limit(10)
      .getRawAndEntities();

    const topRoomsFormatted = topRooms.entities.map((room, index) => ({
      id: room.id,
      name: room.name,
      memberCount: room.memberCount,
      activeMembers: parseInt(topRooms.raw[index]?.activeMembers || '0', 10),
      owner: room.owner
        ? {
            id: room.owner.id,
            username: room.owner.username || room.owner.email,
          }
        : null,
    }));

    // Top tippers
    const topTippers = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.author', 'author')
      .where("message.type = 'tip'")
      .andWhere('message.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('message.createdAt >= :startDate', { startDate })
      .select(['author.id', 'author.username', 'author.email'])
      .addSelect('COUNT(message.id)', 'tipCount')
      .addSelect(
        "SUM(CAST(message.metadata->>'amount' AS DECIMAL))",
        'totalAmount',
      )
      .groupBy('author.id')
      .orderBy('totalAmount', 'DESC')
      .limit(10)
      .getRawMany();

    const topTippersFormatted = topTippers.map((tipper) => ({
      userId: tipper.author_id,
      username: tipper.author_username || tipper.author_email,
      tipCount: parseInt(tipper.tipCount || '0', 10),
      totalAmount: parseFloat(tipper.totalAmount || '0').toFixed(2),
    }));

    const response = {
      users: {
        total: totalUsers,
        newThisPeriod: newUsersThisPeriod,
        activeThisPeriod: activeUserCount,
        banned: bannedUsers,
        growthRate: parseFloat(growthRate.toFixed(3)),
      },
      rooms: {
        total: totalRooms,
        activeThisPeriod: activeRoomsThisPeriod,
        created: roomsCreatedThisPeriod,
        timedExpired: timedExpiredRooms,
      },
      messages: {
        totalThisPeriod: messagesThisPeriod,
        avgPerActiveUser: parseFloat(avgMessagesPerActiveUser.toFixed(1)),
      },
      transactions: {
        totalVolume: totalVolume.toFixed(2),
        platformRevenue: platformRevenue.toFixed(2),
        count: transactionCount,
        avgValue: avgTransactionValue.toFixed(2),
      },
      topRooms: topRoomsFormatted,
      topTippers: topTippersFormatted,
    };

    // Cache for 5 minutes (300 seconds)
    await this.cacheService.set(cacheKey, response, 300);

    await this.logAudit(
      adminId,
      AuditAction.USER_VIEWED,
      null,
      'Viewed overview analytics',
      { period },
      req,
      AuditSeverity.LOW,
    );

    return response;
  }

  async getUserSessions(userId: string): Promise<{
    sessions: Session[];
    total: number;
  }> {
    const sessions = await this.sessionRepository.find({
      where: { userId },
      order: { lastActivity: 'DESC' },
    });
    return { sessions, total: sessions.length };
  }

  async terminateSession(
    userId: string,
    sessionId: string,
    adminId: string,
    req?: Request,
  ): Promise<{ message: string }> {
    await this.sessionRepository.update(
      { id: sessionId, userId },
      { isActive: false },
    );

    await this.logAudit(
      adminId,
      AuditAction.USER_UPDATED,
      userId,
      `Terminated session ${sessionId}`,
      { sessionId },
      req,
      AuditSeverity.MEDIUM,
      'session',
      sessionId,
    );

    return { message: 'Session terminated' };
  }

  async terminateAllUserSessions(
    userId: string,
    adminId: string,
    req?: Request,
  ): Promise<{ message: string }> {
    await this.sessionRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );

    await this.logAudit(
      adminId,
      AuditAction.USER_UPDATED,
      userId,
      'Terminated all active sessions',
      null,
      req,
      AuditSeverity.HIGH,
      'session',
      userId,
    );

    return { message: 'All active sessions terminated' };
  }

  async adminResetPassword(
    userId: string,
    adminId: string,
    req?: Request,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await this.userRepository.update(userId, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpiry,
    } as any);

    await this.sessionRepository
      .createQueryBuilder()
      .update(Session)
      .set({ isActive: false })
      .where('user_id = :userId AND is_active = :isActive', {
        userId,
        isActive: true,
      })
      .execute();

    try {
      this.eventEmitter.emit('user.password.reset.admin', {
        userId,
        email: user.email,
        resetToken,
        adminId,
      });
    } catch (error) {
      this.logger.warn(
        `Password-reset event emit failed for user ${userId}: ${(error as Error).message}`,
      );
    }

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.AUTH_PASSWORD_RESET_REQUESTED,
      eventType: AuditEventType.AUTH,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.HIGH,
      targetUserId: userId,
      details: 'Admin triggered password reset',
      metadata: { adminInitiated: true },
      req,
    });

    return { message: 'Password reset email sent to user' };
  }

  async getRoomDetails(
    roomId: string,
    query: GetRoomDetailsDto,
    adminId: string,
    req?: Request,
  ) {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['owner'],
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [payments, totalPayments] =
      await this.roomPaymentRepository.findAndCount({
        where: { roomId },
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });

    await this.logAudit(
      adminId,
      AuditAction.USER_VIEWED,
      null,
      `Viewed room details for ${roomId}`,
      { roomId, page, limit },
      req,
      AuditSeverity.LOW,
      'room',
      roomId,
    );

    return {
      ...room,
      payments,
      totalPayments,
      page,
      limit,
    };
  }

  async getRooms(query: GetRoomsDto): Promise<{
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
          queryBuilder.andWhere('room.isExpired = :isExpired', {
            isExpired: true,
          });
          break;
        case RoomFilterStatus.FLAGGED:
          queryBuilder.andWhere('room.warningNotificationSent = :flagged', {
            flagged: true,
          });
          break;
        case RoomFilterStatus.DELETED:
          queryBuilder.andWhere('room.isDeleted = :isDeleted', {
            isDeleted: true,
          });
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
          .andWhere('payment.status = :status', {
            status: PaymentStatus.COMPLETED,
          })
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
