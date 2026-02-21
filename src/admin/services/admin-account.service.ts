// src/admin/services/admin-account.service.ts
import {
    Injectable,
    Logger,
    ForbiddenException,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { randomBytes } from 'crypto';
import { Request } from 'express';

import { User } from '../../user/entities/user.entity';
import { UserRole } from '../../roles/entities/role.entity';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from './audit-log.service';
import {
    AuditAction,
    AuditEventType,
    AuditOutcome,
    AuditSeverity,
} from '../entities/audit-log.entity';
import { AdminRole } from '../dto/invite-admin.dto';

/** Roles that qualify as "admin team" accounts */
export const ADMIN_TEAM_ROLES: UserRole[] = [
    UserRole.ADMIN,
    UserRole.MODERATOR,
    UserRole.SUPER_ADMIN,
];

const INVITE_TTL_SECONDS = 48 * 3600; // 48 hours

export interface AdminAccountSummary {
    id: string;
    email: string;
    role: UserRole;
    isDeactivated: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
}

@Injectable()
export class AdminAccountService {
    private readonly logger = new Logger(AdminAccountService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly redisService: RedisService,
        private readonly auditLogService: AuditLogService,
        private readonly mailerService: MailerService,
        private readonly configService: ConfigService,
    ) { }

    // ---------------------------------------------------------------------------
    // List admins
    // ---------------------------------------------------------------------------

    async listAdmins(actorId: string, req?: Request): Promise<AdminAccountSummary[]> {
        const admins = await this.userRepository.find({
            where: { role: In(ADMIN_TEAM_ROLES) },
            select: ['id', 'email', 'role', 'isBanned', 'updatedAt', 'createdAt'],
            order: { createdAt: 'ASC' },
        });

        await this.safeAuditLog({
            actorUserId: actorId,
            action: AuditAction.ADMIN_LISTED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.LOW,
            details: `Listed ${admins.length} admin accounts`,
            metadata: { count: admins.length },
            req,
        });

        return admins.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            isDeactivated: u.isBanned ?? false,
            lastLoginAt: u.updatedAt ?? null,
            createdAt: u.createdAt,
        }));
    }

    // ---------------------------------------------------------------------------
    // Invite admin
    // ---------------------------------------------------------------------------

    async inviteAdmin(
        email: string,
        role: AdminRole,
        actorId: string,
        req?: Request,
    ): Promise<{ message: string; inviteToken?: string }> {
        // Ensure email isn't already registered
        const existing = await this.userRepository.findOne({ where: { email } });
        if (existing) {
            throw new ConflictException(`An account with email ${email} already exists`);
        }

        // Generate a secure invite token and persist in Redis
        const token = randomBytes(32).toString('hex');
        await this.redisService.set(
            `admin:invite:${token}`,
            JSON.stringify({ email, role, invitedBy: actorId }),
            INVITE_TTL_SECONDS,
        );

        // Send invite email (fire-and-forget, errors logged but non-fatal)
        const setupLink = `${this.configService.get<string>('APP_URL', 'https://whspr.com')}/admin/accept-invite?token=${token}`;
        let emailSent = false;
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: 'You have been invited to join the Whspr Stellar admin team',
                template: 'admin-invite',
                context: {
                    email,
                    role,
                    setupLink,
                    expiresInHours: 48,
                    appUrl: this.configService.get<string>('APP_URL', 'https://whspr.com'),
                },
            });
            emailSent = true;
            this.logger.log(`Admin invite email sent to ${email}`);
        } catch (err) {
            this.logger.warn(`Failed to send admin invite email to ${email}: ${err.message}`);
        }

        await this.safeAuditLog({
            actorUserId: actorId,
            action: AuditAction.ADMIN_INVITED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.HIGH,
            details: `Admin invite sent to ${email} with role ${role}`,
            metadata: { email, role, emailSent },
            req,
        });

        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

        return {
            message: `Invite sent to ${email}. They will receive a setup link valid for 48 hours.`,
            // Expose token in non-production so devs can test without email
            ...(!isProduction && { inviteToken: token }),
        };
    }

    // ---------------------------------------------------------------------------
    // Change admin role
    // ---------------------------------------------------------------------------

    async changeRole(
        targetId: string,
        role: AdminRole,
        reason: string,
        actorId: string,
        req?: Request,
    ): Promise<AdminAccountSummary> {
        // SUPER_ADMIN cannot demote themselves
        if (targetId === actorId) {
            throw new ForbiddenException('A SUPER_ADMIN cannot change their own role');
        }

        const target = await this.findAdminOrThrow(targetId);
        const previousRole = target.role;

        target.role = role as unknown as UserRole;
        const saved = await this.userRepository.save(target);

        await this.safeAuditLog({
            actorUserId: actorId,
            targetUserId: targetId,
            action: AuditAction.ADMIN_ROLE_CHANGED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.HIGH,
            details: `Changed admin role from ${previousRole} to ${role}: ${reason}`,
            metadata: { targetEmail: target.email, previousRole, newRole: role, reason },
            resourceType: 'admin_account',
            resourceId: targetId,
            req,
        });

        return this.toSummary(saved);
    }

    // ---------------------------------------------------------------------------
    // Deactivate admin
    // ---------------------------------------------------------------------------

    async deactivateAdmin(
        targetId: string,
        reason: string,
        actorId: string,
        req?: Request,
    ): Promise<{ message: string }> {
        if (targetId === actorId) {
            throw new ForbiddenException('A SUPER_ADMIN cannot deactivate themselves');
        }

        const target = await this.findAdminOrThrow(targetId);

        if (target.isBanned) {
            throw new BadRequestException('Admin account is already deactivated');
        }

        target.isBanned = true;
        target.bannedAt = new Date();
        target.bannedBy = actorId;
        target.banReason = reason;
        await this.userRepository.save(target);

        // Invalidate all active admin sessions in Redis
        await this.redisService.del(`admin:refresh:${targetId}`);

        await this.safeAuditLog({
            actorUserId: actorId,
            targetUserId: targetId,
            action: AuditAction.ADMIN_DEACTIVATED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.CRITICAL,
            details: `Admin account deactivated: ${reason}`,
            metadata: { targetEmail: target.email, reason },
            resourceType: 'admin_account',
            resourceId: targetId,
            req,
        });

        return { message: `Admin account ${target.email} has been deactivated and all sessions revoked` };
    }

    // ---------------------------------------------------------------------------
    // Reactivate admin
    // ---------------------------------------------------------------------------

    async reactivateAdmin(
        targetId: string,
        actorId: string,
        req?: Request,
    ): Promise<AdminAccountSummary> {
        const target = await this.findAdminOrThrow(targetId);

        if (!target.isBanned) {
            throw new BadRequestException('Admin account is not deactivated');
        }

        target.isBanned = false;
        target.bannedAt = null;
        target.bannedBy = null;
        target.banReason = null;
        const saved = await this.userRepository.save(target);

        await this.safeAuditLog({
            actorUserId: actorId,
            targetUserId: targetId,
            action: AuditAction.ADMIN_REACTIVATED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.HIGH,
            details: `Admin account ${target.email} reactivated`,
            metadata: { targetEmail: target.email },
            resourceType: 'admin_account',
            resourceId: targetId,
            req,
        });

        return this.toSummary(saved);
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    private async findAdminOrThrow(adminId: string): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id: adminId } });

        if (!user) {
            throw new NotFoundException(`Admin account with ID ${adminId} not found`);
        }

        if (!ADMIN_TEAM_ROLES.includes(user.role)) {
            throw new BadRequestException(
                `User ${adminId} is not an admin account (role: ${user.role})`,
            );
        }

        return user;
    }

    private toSummary(user: User): AdminAccountSummary {
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            isDeactivated: user.isBanned ?? false,
            lastLoginAt: user.updatedAt ?? null,
            createdAt: user.createdAt,
        };
    }

    private async safeAuditLog(
        input: Parameters<AuditLogService['createAuditLog']>[0],
    ) {
        try {
            await this.auditLogService.createAuditLog(input);
        } catch (err) {
            this.logger.warn(`Failed to write admin account audit log: ${err.message}`);
        }
    }
}
