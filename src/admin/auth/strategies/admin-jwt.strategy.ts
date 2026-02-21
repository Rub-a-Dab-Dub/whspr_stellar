// src/admin/auth/strategies/admin-jwt.strategy.ts
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import { UserRole } from '../../../roles/entities/role.entity';

export const ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR];

export interface AdminJwtPayload {
    sub: string;
    email: string;
    role: UserRole;
    jti: string;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
    constructor(
        private configService: ConfigService,
        private redisService: RedisService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('ADMIN_JWT_SECRET'),
        });
    }

    async validate(payload: AdminJwtPayload) {
        // Check token blacklist
        const isBlacklisted = await this.redisService.exists(`admin:blacklist:${payload.jti}`);
        if (isBlacklisted) {
            throw new UnauthorizedException('Admin token has been revoked');
        }

        // Enforce admin-only role in token payload
        if (!payload.role || !ADMIN_ROLES.includes(payload.role)) {
            throw new ForbiddenException('Insufficient privileges: admin role required');
        }

        return {
            adminId: payload.sub,
            email: payload.email,
            role: payload.role,
            jti: payload.jti,
        };
    }
}
