import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
// import redisStore from 'cache-manager-redis-store';
import { User } from 'src/user/entities/user.entity';
import { Pseudonym } from 'src/pseudonym/entities/pseudonym.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { AuditLog } from 'src/audit-log/entities/audit-log.entity';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Pseudonym, Wallet, AuditLog]),
    CacheModule.register({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      ttl: 300,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
