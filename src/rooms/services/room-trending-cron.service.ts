import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomStatsService } from './room-stats.service';

@Injectable()
export class RoomTrendingCronService {
  private readonly logger = new Logger(RoomTrendingCronService.name);

  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    private statsService: RoomStatsService,
  ) {}

  @Cron('0 */15 * * * *')
  async recalculateTrendingScores(): Promise<void> {
    this.logger.log('Starting trending score recalculation...');

    try {
      const rooms = await this.roomRepository.find({ where: { isActive: true } });

      for (const room of rooms) {
        const score = await this.statsService.getTrendingScore(room.id);
        room.trendingScore = score;
      }

      await this.roomRepository.save(rooms);

      this.logger.log(`Trending scores updated for ${rooms.length} active rooms.`);
    } catch (error) {
      this.logger.error('Failed to recalculate trending scores', (error as Error).stack);
    }
  }
}
