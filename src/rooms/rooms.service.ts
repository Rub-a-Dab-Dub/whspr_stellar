import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Room } from './entities/room.entity';
import { CreateTimedRoomDto, ExtendRoomDto } from './dto/create-timed-room.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserStatsService } from '../users/services/user-stats.service';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    private eventEmitter: EventEmitter2,
    private userStatsService: UserStatsService,
  ) {}

  async createTimedRoom(
    creatorId: string,
    createTimedRoomDto: CreateTimedRoomDto,
  ): Promise<Room> {
    const expiryTimestamp = Date.now() + (createTimedRoomDto.durationMinutes * 60 * 1000);

    const room = this.roomsRepository.create({
      name: createTimedRoomDto.name,
      creatorId,
      expiryTimestamp,
      durationMinutes: createTimedRoomDto.durationMinutes,
      isExpired: false,
      warningNotificationSent: false,
    });

    const savedRoom = await this.roomsRepository.save(room);

    await this.userStatsService.recordRoomCreated(creatorId);
    
    this.logger.log(`Timed room created: ${savedRoom.id}, expires at ${new Date(expiryTimestamp)}`);
    
    // Emit event for Stellar contract interaction if needed
    this.eventEmitter.emit('room.created', {
      roomId: savedRoom.id,
      expiryTimestamp,
      stellarTransactionId: createTimedRoomDto.stellarTransactionId,
    });

    return savedRoom;
  }

  async checkRoomExpiry(roomId: string): Promise<{ isExpired: boolean; timeRemaining: number }> {
    const room = await this.roomsRepository.findOne({ where: { id: roomId } });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (!room.expiryTimestamp) {
      return { isExpired: false, timeRemaining: -1 }; // Permanent room
    }

    const now = Date.now();
    const isExpired = now >= room.expiryTimestamp;
    const timeRemaining = Math.max(0, room.expiryTimestamp - now);

    return { isExpired, timeRemaining };
  }

  async extendRoomDuration(
    roomId: string,
    creatorId: string,
    extendRoomDto: ExtendRoomDto,
  ): Promise<Room> {
    const room = await this.roomsRepository.findOne({ where: { id: roomId } });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.creatorId !== creatorId) {
      throw new BadRequestException('Only room creator can extend duration');
    }

    if (!room.expiryTimestamp) {
      throw new BadRequestException('Cannot extend permanent room');
    }

    if (room.isExpired) {
      throw new BadRequestException('Cannot extend expired room');
    }

    const additionalMs = extendRoomDto.additionalMinutes * 60 * 1000;
    room.expiryTimestamp += additionalMs;
    room.extensionCount += 1;
    room.warningNotificationSent = false; // Reset warning flag

    const updatedRoom = await this.roomsRepository.save(room);

    this.logger.log(`Room ${roomId} extended by ${extendRoomDto.additionalMinutes} minutes`);
    
    this.eventEmitter.emit('room.extended', {
      roomId: updatedRoom.id,
      newExpiryTimestamp: updatedRoom.expiryTimestamp,
    });

    return updatedRoom;
  }

  async findExpiringRoomsSoon(warningMinutes: number = 5): Promise<Room[]> {
    const now = Date.now();
    const warningThreshold = now + (warningMinutes * 60 * 1000);

    return this.roomsRepository.find({
      where: {
        expiryTimestamp: LessThan(warningThreshold),
        isExpired: false,
        warningNotificationSent: false,
      },
    });
  }

  async findExpiredRooms(): Promise<Room[]> {
    const now = Date.now();

    return this.roomsRepository.find({
      where: {
        expiryTimestamp: LessThan(now),
        isExpired: false,
      },
    });
  }

  async markRoomAsExpired(roomId: string): Promise<void> {
    await this.roomsRepository.update(roomId, { isExpired: true });
  }

  async deleteExpiredRoom(roomId: string): Promise<void> {
    const room = await this.roomsRepository.findOne({ where: { id: roomId } });

    if (!room) {
      return;
    }

    // Emit cleanup event for gas refunds and blockchain cleanup
    this.eventEmitter.emit('room.cleanup', {
      roomId: room.id,
      creatorId: room.creatorId,
      expiryTimestamp: room.expiryTimestamp,
    });

    await this.roomsRepository.remove(room);
    
    this.logger.log(`Expired room deleted: ${roomId}`);
  }
}