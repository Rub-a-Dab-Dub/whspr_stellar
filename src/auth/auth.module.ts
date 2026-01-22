import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { UsersModule } from '../user/user.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    UsersModule,
    RedisModule,
    PassportModule,
    JwtModule.register({}), // We configure JWT per token type in the service
  ],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}