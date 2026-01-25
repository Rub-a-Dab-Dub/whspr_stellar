import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './services/rewards.service';
import { RewardAnalyticsService } from './services/reward-analytics.service';
import { RewardMarketplaceService } from './services/reward-marketplace.service';
import { RewardExpirationJob } from './jobs/reward-expiration.job';
import { Reward } from './entities/reward.entity';
import { UserReward } from './entities/user-reward.entity';
import { RewardMarketplace } from './entities/reward-marketplace.entity';
import { User } from '../users/entities/user.entity';
import { QueueModule } from '../queue/queue.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reward, UserReward, RewardMarketplace, User]),
    ScheduleModule.forRoot(),
    QueueModule,
    UsersModule,
  ],
  controllers: [RewardsController],
  providers: [
    RewardsService,
    RewardAnalyticsService,
    RewardMarketplaceService,
    RewardExpirationJob,
  ],
  exports: [RewardsService, RewardAnalyticsService, RewardMarketplaceService],
})
export class RewardsModule {}
