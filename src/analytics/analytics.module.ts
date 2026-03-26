import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsScheduledJobsOperations } from './analytics.jobs';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { DailyMetric } from './entities/daily-metric.entity';
import { AdminAnalyticsGuard } from './guards/admin-analytics.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalyticsEvent, DailyMetric, User]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (_config: ConfigService) => ({
        ttl: 300_000,
      }),
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsScheduledJobsOperations, AdminAnalyticsGuard],
  exports: [AnalyticsService, AnalyticsScheduledJobsOperations],
})
export class AnalyticsModule {}
