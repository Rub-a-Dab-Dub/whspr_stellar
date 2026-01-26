import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RoomMember } from '../entities/room-member.entity';

export const CurrentRoomMember = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RoomMember => {
    const request = ctx.switchToHttp().getRequest();
    return request.roomMember;
  },
);
