import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { JoinRoomDto, ConfirmJoinDto } from './dto/join-room.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { GetRoomsDto } from './dto/get-rooms.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  async createRoom(@Body() createRoomDto: CreateRoomDto, @Request() req) {
    const userId = req.user.sub;
    const walletAddress = req.user.walletAddress;
    return this.roomsService.createRoom(createRoomDto, userId, walletAddress);
  }

  @Get()
  async getRooms(@Query() getRoomsDto: GetRoomsDto) {
    return this.roomsService.getRooms(getRoomsDto);
  }

  @Get(':id')
  async getRoomById(@Param('id') id: string) {
    return this.roomsService.getRoomById(id);
  }

  @Patch(':id')
  async updateRoom(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @Request() req,
  ) {
    const userId = req.user.sub;
    return this.roomsService.updateRoom(id, updateRoomDto, userId);
  }

  @Delete(':id')
  async deleteRoom(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin'; // Assuming role is in JWT
    return this.roomsService.deleteRoom(id, userId, isAdmin);
  }

  @Post(':id/join')
  async joinRoom(
    @Param('id') roomId: string,
    @Body() joinRoomDto: JoinRoomDto,
    @Request() req,
  ) {
    const userId = req.user.sub;
    return this.roomsService.initiateJoin(
      roomId,
      userId,
      joinRoomDto.userWalletAddress,
    );
  }

  @Post(':id/join/confirm')
  async confirmJoin(
    @Param('id') roomId: string,
    @Body() confirmJoinDto: ConfirmJoinDto,
    @Request() req,
  ) {
    const userId = req.user.sub;
    return this.roomsService.confirmJoin(
      roomId,
      userId,
      confirmJoinDto.transactionHash,
    );
  }

  @Post(':id/invite')
  async inviteMember(
    @Param('id') roomId: string,
    @Body() inviteDto: InviteMemberDto,
    @Request() req,
  ) {
    const initiatorId = req.user.sub;
    return this.roomsService.inviteMember(roomId, inviteDto, initiatorId);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') roomId: string,
    @Param('userId') userId: string,
    @Request() req,
  ) {
    const initiatorId = req.user.sub;
    return this.roomsService.removeMember(roomId, userId, initiatorId);
  }

  @Post(':id/ban/:userId')
  async banMember(
    @Param('id') roomId: string,
    @Param('userId') userId: string,
    @Request() req,
  ) {
    const initiatorId = req.user.sub;
    return this.roomsService.banMember(roomId, userId, initiatorId);
  }

  @Patch(':id/members/:userId/role')
  async updateMemberRole(
    @Param('id') roomId: string,
    @Param('userId') userId: string,
    @Body() updateRoleDto: UpdateMemberRoleDto,
    @Request() req,
  ) {
    const initiatorId = req.user.sub;
    return this.roomsService.updateMemberRole(
      roomId,
      userId,
      updateRoleDto,
      initiatorId,
    );
  }

  @Get(':id/members')
  async getRoomMembers(
    @Param('id') roomId: string,
    @Query() getRoomsDto: GetRoomsDto,
  ) {
    return this.roomsService.getMembers(roomId, getRoomsDto);
  }
}
