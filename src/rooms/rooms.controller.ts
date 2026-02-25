import { Controller, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { JoinRoomDto, ConfirmJoinDto } from './dto/join-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post(':id/join')
  async joinRoom(@Param('id') roomId: string, @Body() joinRoomDto: JoinRoomDto, @Request() req) {
    const userId = req.user.sub;
    return this.roomsService.initiateJoin(roomId, userId, joinRoomDto.userWalletAddress);
  }

  @Post(':id/join/confirm')
  async confirmJoin(@Param('id') roomId: string, @Body() confirmJoinDto: ConfirmJoinDto, @Request() req) {
    const userId = req.user.sub;
    return this.roomsService.confirmJoin(roomId, userId, confirmJoinDto.transactionHash);
  }
}