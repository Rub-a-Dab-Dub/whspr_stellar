import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomType } from '../entities/room.entity';
import { ExtendRoomDto } from '../dto/extend-room.dto';

@Injectable()
export class RoomExpirationService {
  constructor(
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
  ) {}

  async extendRoom(roomId: string, userId: string, dto: ExtendRoomDto): Promise<Room> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== userId) throw new BadRequestException('Only owner can extend');
    if (room.roomType !== RoomType.TIMED) throw new BadRequestException('Not a timed room');
    if (room.isExpired) throw new BadRequestException('Room already expired');

    room.expiryTimestamp += dto.additionalMinutes * 60 * 1000;
    room.extensionCount += 1;
    room.warningNotificationSent = false;

    return this.roomRepo.save(room);
  }

  async getExpirationAnalytics() {
    const [total, expired, nearExpiry] = await Promise.all([
      this.roomRepo.count({ where: { roomType: RoomType.TIMED } }),
      this.roomRepo.count({ where: { roomType: RoomType.TIMED, isExpired: true } }),
      this.roomRepo.count({ 
        where: { 
          roomType: RoomType.TIMED, 
          isExpired: false,
          expiryTimestamp: Date.now() + 3600000 
        } 
      }),
    ]);

    return { total, expired, nearExpiry };
  }
}
