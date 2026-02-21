// rooms/tasks/room-cleanup.task.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RoomsService } from '../rooms.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class RoomCleanupTask {
  private readonly logger = new Logger(RoomCleanupTask.name);

  constructor(
    private roomsService: RoomsService,
    private eventEmitter: EventEmitter2,
  ) {}

  // Run every minute to check for expired rooms
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredRooms() {
    this.logger.debug('Checking for expired rooms...');

    const expiredRooms = await this.roomsService.findExpiredRooms();

    if (expiredRooms.length === 0) {
      return;
    }

    this.logger.log(`Found ${expiredRooms.length} expired rooms`);

    for (const room of expiredRooms) {
      try {
        await this.roomsService.markRoomAsExpired(room.id);
        await this.roomsService.deleteExpiredRoom(room.id);
      } catch (error) {
        this.logger.error(`Failed to cleanup room ${room.id}:`, error);
      }
    }
  }

  // Run every 2 minutes to send warning notifications
  @Cron('*/2 * * * *')
  async handleExpiringRooms() {
    this.logger.debug('Checking for expiring rooms...');

    const expiringRooms = await this.roomsService.findExpiringRoomsSoon(5);

    if (expiringRooms.length === 0) {
      return;
    }

    this.logger.log(`Found ${expiringRooms.length} rooms expiring soon`);

    for (const room of expiringRooms) {
      try {
        this.eventEmitter.emit('room.expiring-soon', {
          roomId: room.id,
          creatorId: room.creatorId,
          expiryTimestamp: room.expiryTimestamp,
          minutesRemaining: Math.floor(
            (room.expiryTimestamp - Date.now()) / 60000,
          ),
        });

        // Mark warning as sent
        await this.roomsService['roomsRepository'].update(room.id, {
          warningNotificationSent: true,
        });
      } catch (error) {
        this.logger.error(`Failed to send warning for room ${room.id}:`, error);
      }
    }
  }
}
