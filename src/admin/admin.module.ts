import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { User } from '../user/entities/user.entity';
import { Payment } from '../payments/entities/payment.entity';
import { MessageMedia } from '../messages/entities/message-media.entity';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Payment, MessageMedia]),
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      ttl: 300, // 5 minutes
    }),
  ],
  controllers: [AdminStatsController],
  providers: [AdminStatsService],
})
export class AdminModule {}
