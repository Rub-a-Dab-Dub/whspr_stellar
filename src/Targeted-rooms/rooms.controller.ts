import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateTimedRoomDto, ExtendRoomDto } from './dto/create-timed-room.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post('timed')
  async createTimedRoom(
    @Request() req,
    @Body() createTimedRoomDto: CreateTimedRoomDto,
  ) {
    return this.roomsService.createTimedRoom(req.user.id, createTimedRoomDto);
  }

  @Get(':id/expiry-status')
  async checkExpiry(@Param('id') id: string) {
    return this.roomsService.checkRoomExpiry(id);
  }

  @Patch(':id/extend')
  async extendDuration(
    @Request() req,
    @Param('id') id: string,
    @Body() extendRoomDto: ExtendRoomDto,
  ) {
    return this.roomsService.extendRoomDuration(id, req.user.id, extendRoomDto);
  }
}