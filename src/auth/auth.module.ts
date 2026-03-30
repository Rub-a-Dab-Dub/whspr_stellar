import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyAuthGuard } from '../api-keys/guards/api-key-auth.guard';

import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { CryptoService } from './services/crypto.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

import { AuthChallenge } from './entities/auth-challenge.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthAttempt } from './entities/auth-attempt.entity';

import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';
import { TwoFactorModule } from '../two-factor/two-factor.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthChallenge, RefreshToken, AuthAttempt]),
    forwardRef(() => TwoFactorModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    UsersModule,
    SessionsModule,
    ApiKeysModule,
    FraudDetectionModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CryptoService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: ApiKeyAuthGuard,
    },
    // Apply JwtAuthGuard globally — routes opt-out with @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
