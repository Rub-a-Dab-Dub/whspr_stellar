import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { LeaderboardEntry, LeaderboardSnapshot } from './entities/leaderboard-entry.entity';
import { LeaderboardEntriesRepository, LeaderboardSnapshotsRepository } from './leaderboard.repository';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { RedisLeaderboardService } from './redis-leaderboard.service';
import { UsersModule } from '../users/users.module';
import { RedisCacheModule } from '../cache/redis-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaderboardEntry, LeaderboardSnapshot]),
    ScheduleModule.forRoot(),
    UsersModule,
    RedisCacheModule,
  ],
  providers: [
    LeaderboardEntriesRepository,
    LeaderboardSnapshotsRepository,
    LeaderboardService,
    RedisLeaderboardService,
  ],
  controllers: [LeaderboardController],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
