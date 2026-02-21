import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RoomRoleService } from '../services/room-role.service';

@Injectable()
export class RoomAccessGuard implements CanActivate {
  constructor(private roomRoleService: RoomRoleService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const roomId = request.params.roomId;

    if (!user || !roomId) {
      return false;
    }

    const userId = user.userId || user.id;

    // Verify room access
    const access = await this.roomRoleService.verifyRoomAccess(roomId, userId);

    if (!access.canAccess) {
      throw new ForbiddenException(access.reason);
    }

    return true;
  }
}
