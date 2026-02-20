import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './controller/leaderboard.controller';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import { LeaderboardSnapshot } from './entities/leaderboard-snapshot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaderboardEntry, LeaderboardSnapshot]),
    ScheduleModule.forRoot(), // Enable cron jobs
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService], // Export for use in other modules
})
export class LeaderboardModule {}