import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { PinataService } from './services/pinata.service';
import { XpHistory } from './entities/xp-history.entity';
import { XpService } from './services/xp.service';
import { Streak } from './entities/streak.entity';
import { StreakReward } from './entities/streak-reward.entity';
import { StreakBadge } from './entities/streak-badge.entity';
import { StreakHistory } from './entities/streak-history.entity';
import { StreakService } from './services/streak.service';
import { CacheModule } from '../cache/cache.module';
import { UserStats } from './entities/user-stats.entity';
import { UserStatsDaily } from './entities/user-stats-daily.entity';
import { UserStatsWeekly } from './entities/user-stats-weekly.entity';
import { UserStatsService } from './services/user-stats.service';
import { UserStatsAggregationJob } from './jobs/user-stats-aggregation.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      XpHistory,
      Streak,
      StreakReward,
      StreakBadge,
      StreakHistory,
      UserStats,
      UserStatsDaily,
      UserStatsWeekly,
    ]),
    CacheModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    PinataService,
    XpService,
    StreakService,
    UserStatsService,
    UserStatsAggregationJob,
  ],
  exports: [UsersService, XpService, StreakService, UserStatsService],
})
export class UsersModule {}
