// src/admin/auth/admin-auth.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AdminAuthService } from './admin-auth.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { AdminJwtRefreshStrategy } from './strategies/admin-jwt-refresh.strategy';

import { UsersModule } from '../../user/user.module';
import { RedisModule } from '../../redis/redis.module';
import { AdminModule } from '../admin.module';

@Module({
    imports: [
        PassportModule,
        JwtModule.register({}), // Secrets configured per call in service
        UsersModule,
        RedisModule,
        forwardRef(() => AdminModule), // AuditLogService lives in AdminModule
    ],
    providers: [AdminAuthService, AdminJwtStrategy, AdminJwtRefreshStrategy],
    controllers: [AdminAuthController],
    exports: [AdminAuthService],
})
export class AdminAuthModule { }
