import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaderboardEntry]),
    ScheduleModule.forRoot(), // Enable cron jobs
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService], // Export for use in other modules
})
export class LeaderboardModule {}