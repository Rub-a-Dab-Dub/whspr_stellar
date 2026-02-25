import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { User } from '../user/entities/user.entity';
import { Payment } from '../payments/entities/payment.entity';
import { MessageMedia } from '../messages/entities/message-media.entity';
import { Report } from './entities/report.entity';
import { AdminAction } from './entities/admin-action.entity';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Payment, MessageMedia, Report, AdminAction]),
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      ttl: 300, // 5 minutes
    }),
  ],
  controllers: [AdminStatsController, ModerationController],
  providers: [AdminStatsService, ModerationService],
})
export class AdminModule {}
