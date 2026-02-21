// src/admin/auth/admin-auth.service.ts
import {
    Injectable,
    UnauthorizedException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../user/user.service';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from '../services/audit-log.service';
import {
    AuditAction,
    AuditEventType,
    AuditOutcome,
    AuditSeverity,
} from '../entities/audit-log.entity';
import { UserRole } from '../../roles/entities/role.entity';
import { ADMIN_ROLES, AdminJwtPayload } from './strategies/admin-jwt.strategy';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Request } from 'express';

/** Roles whose tokens carry admin claim */
const ADMIN_ROLE_COLUMN_VALUES: UserRole[] = [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.MODERATOR,
];

const BRUTE_FORCE_MAX_ATTEMPTS = 5;
const BRUTE_FORCE_WINDOW_SECONDS = 10 * 60; // 10 minutes
const BRUTE_FORCE_LOCKOUT_SECONDS = 30 * 60; // 30 minutes

@Injectable()
export class AdminAuthService {
    private readonly logger = new Logger(AdminAuthService.name);

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
        private readonly auditLogService: AuditLogService,
    ) { }

    // ---------------------------------------------------------------------------
    // Login
    // ---------------------------------------------------------------------------

    async login(email: string, password: string, req?: Request) {
        // Brute-force: check lockout before anything else
        const lockKey = `admin:login:locked:${email}`;
        const isLocked = await this.redisService.exists(lockKey);
        if (isLocked) {
            const ttl = await this.redisService.ttl(lockKey);
            const minutesLeft = Math.ceil(ttl / 60);
            await this.safeAuditLog({
                actorUserId: null,
                targetUserId: null,
                action: AuditAction.AUTH_LOGIN_FAILED,
                eventType: AuditEventType.AUTH,
                outcome: AuditOutcome.FAILURE,
                severity: AuditSeverity.HIGH,
                details: `Admin login blocked: account locked (${minutesLeft} min remaining)`,
                metadata: { email },
                req,
            });
            throw new UnauthorizedException(
                `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`,
            );
        }

        // Find user
        const user = await this.usersService.findByEmail(email);

        if (!user) {
            await this.recordFailedAttempt(email, null, req);
            throw new UnauthorizedException('Invalid credentials');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password || '');

        if (!isPasswordValid) {
            await this.recordFailedAttempt(email, user.id || null, req);
            throw new UnauthorizedException('Invalid credentials');
        }

        // Determine role — check the direct role column first, then roles relation
        const directRole = user.role;
        const relationRole = user.roles?.find((r) =>
            ADMIN_ROLES.includes(r.name),
        )?.name;
        const adminRole = ADMIN_ROLE_COLUMN_VALUES.includes(directRole)
            ? directRole
            : relationRole;

        if (!adminRole) {
            // Log non-admin attempt
            await this.safeAuditLog({
                actorUserId: user.id || null,
                targetUserId: user.id || null,
                action: AuditAction.AUTH_LOGIN_FAILED,
                eventType: AuditEventType.AUTH,
                outcome: AuditOutcome.FAILURE,
                severity: AuditSeverity.MEDIUM,
                details: 'Admin login rejected: insufficient role',
                metadata: { email, role: directRole },
                req,
            });
            throw new ForbiddenException(
                'Access denied: admin privileges are required',
            );
        }

        // Clear brute-force counters on successful auth
        await this.clearBruteForce(email);

        // Issue tokens
        const tokens = await this.generateAdminTokens(
            user.id || '',
            user.email || '',
            adminRole,
        );

        await this.safeAuditLog({
            actorUserId: user.id || null,
            targetUserId: user.id || null,
            action: AuditAction.AUTH_LOGIN_SUCCESS,
            eventType: AuditEventType.AUTH,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.LOW,
            details: 'Admin login successful',
            metadata: { email, role: adminRole },
            req,
        });

        return {
            access_token: tokens.accessToken,
            expires_in: this.getExpiresInSeconds(),
            admin: {
                id: user.id,
                email: user.email,
                role: adminRole,
            },
        };
    }

    // ---------------------------------------------------------------------------
    // Refresh
    // ---------------------------------------------------------------------------

    async refresh(adminId: string, email: string, role: UserRole, req?: Request) {
        // Tokens are already validated by AdminJwtRefreshStrategy.
        // Just issue fresh access + refresh tokens.
        const tokens = await this.generateAdminTokens(adminId, email, role);

        return {
            access_token: tokens.accessToken,
            expires_in: this.getExpiresInSeconds(),
        };
    }

    // ---------------------------------------------------------------------------
    // Logout
    // ---------------------------------------------------------------------------

    async logout(adminId: string, jti: string, req?: Request) {
        // Blacklist the access token
        const accessExpiry = this.parseTime(
            this.configService.get<string>('ADMIN_JWT_EXPIRES_IN') || '2h',
        );
        await this.redisService.set(`admin:blacklist:${jti}`, '1', accessExpiry);

        // Revoke refresh token
        await this.redisService.del(`admin:refresh:${adminId}`);

        await this.safeAuditLog({
            actorUserId: adminId,
            targetUserId: adminId,
            action: AuditAction.AUTH_LOGOUT,
            eventType: AuditEventType.AUTH,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.LOW,
            details: 'Admin logout successful',
            req,
        });

        return { message: 'Admin logout successful' };
    }

    // ---------------------------------------------------------------------------
    // Token generation
    // ---------------------------------------------------------------------------

    async generateAdminTokens(userId: string, email: string, role: UserRole) {
        const jti = randomBytes(16).toString('hex');
        const expiresIn =
            this.configService.get<string>('ADMIN_JWT_EXPIRES_IN') || '2h';

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(
                { sub: userId, email, role, jti } satisfies Partial<AdminJwtPayload>,
                {
                    secret: this.configService.get<string>('ADMIN_JWT_SECRET'),
                    expiresIn,
                },
            ),
            this.jwtService.signAsync(
                { sub: userId, email, role, jti: randomBytes(16).toString('hex') },
                {
                    secret: this.configService.get<string>('ADMIN_JWT_REFRESH_SECRET'),
                    expiresIn: '7d',
                },
            ),
        ]);

        // Store refresh token in Redis (7 days TTL)
        await this.redisService.set(
            `admin:refresh:${userId}`,
            refreshToken,
            7 * 24 * 3600,
        );

        return { accessToken, refreshToken };
    }

    // ---------------------------------------------------------------------------
    // Brute-force helpers
    // ---------------------------------------------------------------------------

    private async recordFailedAttempt(
        email: string,
        userId: string | null,
        req?: Request,
    ) {
        const attemptsKey = `admin:login:attempts:${email}`;
        const lockKey = `admin:login:locked:${email}`;

        // Increment attempt counter
        const raw = await this.redisService.get(attemptsKey);
        const attempts = raw ? parseInt(raw, 10) + 1 : 1;
        await this.redisService.set(
            attemptsKey,
            String(attempts),
            BRUTE_FORCE_WINDOW_SECONDS,
        );

        await this.safeAuditLog({
            actorUserId: userId,
            targetUserId: userId,
            action: AuditAction.AUTH_LOGIN_FAILED,
            eventType: AuditEventType.AUTH,
            outcome: AuditOutcome.FAILURE,
            severity: AuditSeverity.MEDIUM,
            details: `Admin login failed attempt ${attempts}/${BRUTE_FORCE_MAX_ATTEMPTS}`,
            metadata: { email, attempts },
            req,
        });

        if (attempts >= BRUTE_FORCE_MAX_ATTEMPTS) {
            // Lock account
            await this.redisService.set(lockKey, '1', BRUTE_FORCE_LOCKOUT_SECONDS);
            // Clear attempts counter
            await this.redisService.del(attemptsKey);

            this.logger.warn(
                `[ADMIN SECURITY ALERT] Account ${email} locked after ${BRUTE_FORCE_MAX_ATTEMPTS} ` +
                `failed login attempts. Lock duration: ${BRUTE_FORCE_LOCKOUT_SECONDS / 60} minutes.`,
            );

            await this.safeAuditLog({
                actorUserId: userId,
                targetUserId: userId,
                action: AuditAction.AUTH_LOGIN_FAILED,
                eventType: AuditEventType.AUTH,
                outcome: AuditOutcome.FAILURE,
                severity: AuditSeverity.CRITICAL,
                details: `Admin account locked after ${BRUTE_FORCE_MAX_ATTEMPTS} failed attempts`,
                metadata: { email, lockDurationMinutes: BRUTE_FORCE_LOCKOUT_SECONDS / 60 },
                req,
            });
        }
    }

    private async clearBruteForce(email: string) {
        await Promise.all([
            this.redisService.del(`admin:login:attempts:${email}`),
            this.redisService.del(`admin:login:locked:${email}`),
        ]);
    }

    // ---------------------------------------------------------------------------
    // Utilities
    // ---------------------------------------------------------------------------

    private getExpiresInSeconds(): number {
        return this.parseTime(
            this.configService.get<string>('ADMIN_JWT_EXPIRES_IN') || '2h',
        );
    }

    private parseTime(timeString: string): number {
        const unit = timeString.slice(-1);
        const value = parseInt(timeString.slice(0, -1), 10);
        const multipliers: Record<string, number> = {
            s: 1,
            m: 60,
            h: 3600,
            d: 86400,
        };
        return value * (multipliers[unit] ?? 1);
    }

    private async safeAuditLog(
        input: Parameters<AuditLogService['createAuditLog']>[0],
    ) {
        try {
            await this.auditLogService.createAuditLog(input);
        } catch (error) {
            this.logger.warn(`Failed to write admin audit log: ${error.message}`);
        }
    }
}
