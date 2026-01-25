import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { GetUsersDto, UserFilterStatus } from './dto/get-users.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { BulkActionDto, BulkActionType } from './dto/bulk-action.dto';
import { Request } from 'express';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  private async logAudit(
    adminId: string,
    action: AuditAction,
    targetUserId: string | null,
    details: string | null = null,
    metadata: Record<string, any> | null = null,
    req?: Request,
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      adminId,
      action,
      targetUserId,
      details,
      metadata,
      ipAddress: req?.ip || req?.socket.remoteAddress || null,
      userAgent: req?.headers['user-agent'] || null,
    });

    return await this.auditLogRepository.save(auditLog);
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

    await this.logAudit(
      adminId,
      AuditAction.BULK_ACTION,
      null,
      `Bulk action: ${action} on ${userIds.length} users`,
      {
        action,
        userIds,
        success,
        failed,
        reason,
      },
      req,
    );

    return { success, failed, errors };
  }

  async getUserStatistics(): Promise<{
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

  async getUserActivity(userId: string): Promise<{
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
      relations: ['admin'],
    });

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
    page: number = 1,
    limit: number = 50,
    adminId?: string,
    targetUserId?: string,
  ): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.auditLogRepository.createQueryBuilder('log');

    if (adminId) {
      queryBuilder.andWhere('log.adminId = :adminId', { adminId });
    }

    if (targetUserId) {
      queryBuilder.andWhere('log.targetUserId = :targetUserId', { targetUserId });
    }

    queryBuilder
      .leftJoinAndSelect('log.admin', 'admin')
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
}
