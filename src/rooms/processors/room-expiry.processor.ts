import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Room } from '../entities/room.entity';
import { RoomsGateway } from '../gateways/rooms.gateway';
import { QUEUE_NAMES } from '../../queues/queues.module';

export const EXPIRE_ROOM_JOB = 'expire-room';
export const GRACE_PERIOD_CLEANUP_JOB = 'grace-period-cleanup';

export interface ExpireRoomJobData {
  roomId: string;
}

export interface GracePeriodJobData {
  roomId: string;
}

@Processor(QUEUE_NAMES.ROOM_EXPIRY)
export class RoomExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(RoomExpiryProcessor.name);

  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly roomsGateway: RoomsGateway,
    @InjectQueue(QUEUE_NAMES.ROOM_EXPIRY)
    private readonly roomExpiryQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === EXPIRE_ROOM_JOB) {
      await this.handleExpireRoom(job as Job<ExpireRoomJobData>);
    } else if (job.name === GRACE_PERIOD_CLEANUP_JOB) {
      await this.handleGracePeriodCleanup(job as Job<GracePeriodJobData>);
    }
  }

  private async handleExpireRoom(job: Job<ExpireRoomJobData>): Promise<void> {
    const { roomId } = job.data;
    this.logger.log(`Processing expiry for room ${roomId}`);

    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      this.logger.warn(`Room ${roomId} not found — skipping expiry`);
      return;
    }

    if (room.isExpired) {
      this.logger.log(`Room ${roomId} already expired — skipping`);
      return;
    }

    // Mark as expired
    room.isExpired = true;
    await this.roomRepository.save(room);

    // Notify members via WebSocket
    this.roomsGateway.notifyRoomExpired(roomId);

    // Schedule grace-period cleanup
    const gracePeriodHours = this.configService.get<number>(
      'ROOM_GRACE_PERIOD_HOURS',
      24,
    );
    const gracePeriodMs = gracePeriodHours * 60 * 60 * 1000;

    await this.roomExpiryQueue.add(
      GRACE_PERIOD_CLEANUP_JOB,
      { roomId } as GracePeriodJobData,
      {
        delay: gracePeriodMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log(
      `Room ${roomId} expired. Grace-period cleanup scheduled in ${gracePeriodHours}h`,
    );
  }

  private async handleGracePeriodCleanup(
    job: Job<GracePeriodJobData>,
  ): Promise<void> {
    const { roomId } = job.data;
    this.logger.log(`Grace-period cleanup for room ${roomId}`);

    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      this.logger.warn(`Room ${roomId} not found during grace-period cleanup`);
      return;
    }

    if (room.archivedAt) {
      this.logger.log(`Room ${roomId} already archived — skipping`);
      return;
    }

    // Hard-delete all messages in this room
    await this.roomRepository.manager.query(
      `DELETE FROM messages WHERE room_id = $1`,
      [roomId],
    );

    // Archive the room
    room.isActive = false;
    room.archivedAt = new Date();
    await this.roomRepository.save(room);

    this.logger.log(
      `Room ${roomId} archived. All messages permanently deleted.`,
    );
  }
}
