import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RoomPaymentService } from '../services/room-payment.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';

@Injectable()
export class RoomAccessGuard implements CanActivate {
  constructor(
    private roomPaymentService: RoomPaymentService,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const roomId = request.params.id || request.params.roomId;

    if (!user || !roomId) {
      throw new ForbiddenException('Authentication required');
    }

    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['creator']
    });

    if (!room) {
      throw new ForbiddenException('Room not found');
    }

    // Room creator always has access
    if (room.creator && room.creator.id === user.id) {
      return true;
    }

    // If room doesn't require payment, allow access
    if (!room.isTokenGated && !room.paymentRequired) {
      return true;
    }

    // Check if user has paid and has valid access
    const access = await this.roomPaymentService.checkUserAccess(user.id, roomId);

    if (!access.hasAccess) {
      throw new ForbiddenException('Payment required to access this room');
    }

    if (access.isExpired) {
      throw new ForbiddenException('Your access to this room has expired');
    }

    return true;
  }
}
