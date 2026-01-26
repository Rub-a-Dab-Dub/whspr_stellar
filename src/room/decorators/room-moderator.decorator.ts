import { UseGuards, applyDecorators } from '@nestjs/common';
import { RoomModeratorGuard } from '../guards/room-moderator.guard';

export const IsRoomModerator = () => applyDecorators(UseGuards(RoomModeratorGuard));
