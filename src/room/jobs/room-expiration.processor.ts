import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Room, RoomType } from '../entities/room.entity';
import { Message } from '../../message/entities/message.entity';
import { ArchivedMessage } from '../../message/entities/archived-message.entity';
import { NotificationService } from '../../notifications/services/notification.service';
import { NotificationType } from '../../notifications/enums/notification-type.enum';

@Injectable()
@Processor('room-expiration')
export class RoomExpirationProcessor {
  private readonly logger = new Logger(RoomExpirationProcessor.name);

  constructor(
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
    @InjectRepository(ArchivedMessage)
    private archivedRepo: Repository<ArchivedMessage>,
    private notificationService: NotificationService,
  ) {}

  @Process('check-expiration')
  async handleExpiration(job: Job) {
    this.logger.log('Checking for expired rooms...');
    
    const now = Date.now();
    const warningThreshold = now + 60 * 60 * 1000; // 1 hour before expiry

    // Send warnings
    const roomsNearExpiry = await this.roomRepo.find({
      where: {
        roomType: RoomType.TIMED,
        isExpired: false,
        isDeleted: false,
        warningNotificationSent: false,
        expiryTimestamp: LessThan(warningThreshold),
      },
      relations: ['owner'],
    });

    for (const room of roomsNearExpiry) {
      await this.sendExpiryWarning(room);
      room.warningNotificationSent = true;
      await this.roomRepo.save(room);
    }

    // Delete expired rooms
    const expiredRooms = await this.roomRepo.find({
      where: {
        roomType: RoomType.TIMED,
        isExpired: false,
        isDeleted: false,
        expiryTimestamp: LessThan(now),
      },
    });

    for (const room of expiredRooms) {
      await this.archiveAndDeleteRoom(room);
    }

    this.logger.log(`Processed ${roomsNearExpiry.length} warnings, ${expiredRooms.length} deletions`);
  }

  private async sendExpiryWarning(room: Room) {
    const timeLeft = Math.floor((room.expiryTimestamp - Date.now()) / 60000);
    
    await this.notificationService.createNotification({
      recipientId: room.ownerId,
      type: NotificationType.SYSTEM,
      title: 'Room Expiring Soon',
      message: `Room "${room.name}" will expire in ${timeLeft} minutes`,
      data: { roomId: room.id, expiryTimestamp: room.expiryTimestamp },
      actionUrl: `/rooms/${room.id}`,
    });
  }

  private async archiveAndDeleteRoom(room: Room) {
    // Archive messages
    const messages = await this.messageRepo.find({ where: { roomId: room.id } });
    
    const archived = messages.map(msg => this.archivedRepo.create({
      roomId: room.id,
      messageId: msg.id,
      authorId: msg.authorId,
      content: msg.content,
      metadata: { type: msg.type, mediaUrl: msg.mediaUrl },
      originalCreatedAt: msg.createdAt,
    }));

    await this.archivedRepo.save(archived);

    // Mark room as expired and deleted
    room.isExpired = true;
    room.isDeleted = true;
    room.deletedAt = new Date();
    await this.roomRepo.save(room);

    this.logger.log(`Archived ${messages.length} messages and deleted room ${room.id}`);
  }
}
