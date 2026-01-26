import { UseGuards, applyDecorators } from '@nestjs/common';
import { RoomAdminGuard } from '../guards/room-admin.guard';

export const IsRoomAdmin = () => applyDecorators(UseGuards(RoomAdminGuard));
