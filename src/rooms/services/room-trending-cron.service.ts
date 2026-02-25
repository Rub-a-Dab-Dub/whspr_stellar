import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomMember } from '../entities/room-member.entity';

/**
 * Recalculates trendingScore for every active room every 15 minutes.
 *
 * Formula:
 *   trendingScore = messageCount24h × memberCount
 *
 * The score is stored on the Room entity so discovery queries can simply
 * ORDER BY trending_score DESC without running expensive aggregations on
 * every request.
 */
@Injectable()
export class RoomTrendingCronService {
  private readonly logger = new Logger(RoomTrendingCronService.name);

  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    private dataSource: DataSource,
  ) {}

  @Cron('0 */15 * * * *')
  async recalculateTrendingScores(): Promise<void> {
    this.logger.log('Starting trending score recalculation...');

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      /**
       * Run a single UPDATE ... FROM (...) query for efficiency instead
       * of loading all rooms into memory.
       *
       * PostgreSQL syntax:
       *   UPDATE rooms r
       *   SET trending_score = aggregated.score
       *   FROM (
       *     SELECT
       *       r2.id,
       *       COALESCE(m.msg_count, 0) * COALESCE(rm.member_count, 0) AS score
       *     FROM rooms r2
       *     LEFT JOIN (
       *       SELECT room_id, COUNT(*) AS msg_count
       *       FROM   messages
       *       WHERE  created_at >= :since24h
       *       GROUP  BY room_id
       *     ) m ON m.room_id = r2.id
       *     LEFT JOIN (
       *       SELECT room_id, COUNT(*) AS member_count
       *       FROM   room_members
       *       GROUP  BY room_id
       *     ) rm ON rm.room_id = r2.id
       *     WHERE r2.is_active = true
       *   ) aggregated
       *   WHERE r.id = aggregated.id
       */
      await this.dataSource.query(
        `
        UPDATE rooms r
        SET trending_score = aggregated.score
        FROM (
          SELECT
            r2.id,
            COALESCE(m.msg_count, 0) * COALESCE(rm.member_count, 0) AS score
          FROM rooms r2
          LEFT JOIN (
            SELECT room_id, COUNT(*) AS msg_count
            FROM   messages
            WHERE  created_at >= $1
            GROUP  BY room_id
          ) m ON m.room_id = r2.id
          LEFT JOIN (
            SELECT room_id, COUNT(*) AS member_count
            FROM   room_members
            GROUP  BY room_id
          ) rm ON rm.room_id = r2.id
          WHERE r2.is_active = true
        ) aggregated
        WHERE r.id = aggregated.id
        `,
        [since24h],
      );

      const updatedCount = await this.roomRepository.count({
        where: { isActive: true },
      });
      this.logger.log(
        `Trending scores updated for ${updatedCount} active rooms.`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to recalculate trending scores',
        (error as Error).stack,
      );
    }
  }
}
