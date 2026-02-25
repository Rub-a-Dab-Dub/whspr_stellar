import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull, Not } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Room } from '../entities/room.entity';
import { QUEUE_NAMES } from '../../queues/queues.module';
import {
  EXPIRE_ROOM_JOB,
  ExpireRoomJobData,
} from '../processors/room-expiry.processor';

/**
 * Cron fallback: runs every minute and fires expiry jobs for any timed rooms
 * that have passed their expiresAt but were not caught by the scheduled BullMQ job
 * (e.g. due to a Redis outage or server restart).
 */
@Injectable()
export class RoomExpiryCronService {
  private readonly logger = new Logger(RoomExpiryCronService.name);

  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectQueue(QUEUE_NAMES.ROOM_EXPIRY)
    private readonly roomExpiryQueue: Queue,
  ) {}

  @Cron('0 * * * * *') // every minute
  async checkExpiredRooms(): Promise<void> {
    const now = new Date();

    const missedRooms = await this.roomRepository.find({
      where: {
        isExpired: false,
        expiresAt: LessThanOrEqual(now),
      },
      select: ['id', 'expiresAt', 'isExpired'],
    });

    if (missedRooms.length === 0) return;

    this.logger.warn(
      `Cron fallback: found ${missedRooms.length} missed room expiry(ies). Enqueuing...`,
    );

    for (const room of missedRooms) {
      await this.roomExpiryQueue.add(
        EXPIRE_ROOM_JOB,
        { roomId: room.id } as ExpireRoomJobData,
        { attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
      );
    }
  }
}
