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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { JoinRoomDto, ConfirmJoinDto } from './dto/join-room.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { GetRoomsDto } from './dto/get-rooms.dto';
import { SearchRoomsDto } from './dto/search-rooms.dto';
import { DiscoverRoomsDto } from './dto/discover-rooms.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoomStatsService } from './services/room-stats.service';
import { GetRoomStatsDto } from './dto/get-room-stats.dto';

@ApiTags('rooms')
@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly statsService: RoomStatsService,
  ) {}

  // ─── Discovery endpoints ─────────────────────────────────────────────────────

  @Get('discover')
  @ApiOperation({
    summary: 'Trending rooms',
    description:
      'Returns active rooms ranked by trending score (messageCount24h × memberCount), ' +
      'recalculated every 15 minutes. Supports cursor-based pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of trending rooms with nextCursor',
  })
  async getTrendingRooms(@Query() dto: DiscoverRoomsDto) {
    return this.roomsService.getTrendingRooms(dto);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search rooms',
    description:
      'Filter rooms by keyword (q), tags, entry fee range (minFee / maxFee), ' +
      'and blockchain network (chain). Cursor-based pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Filtered room list with nextCursor',
  })
  async searchRooms(@Query() dto: SearchRoomsDto) {
    return this.roomsService.searchRooms(dto);
  }

  // ─── Standard CRUD ───────────────────────────────────────────────────────────

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
    const isAdmin = req.user.role === 'admin';
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

  @Get(':id/stats')
  async getRoomStats(
    @Param('id') roomId: string,
    @Query() dto: GetRoomStatsDto,
    @Request() req,
  ) {
    const room = await this.roomsService.findOne(roomId);
    const userId = req.user.sub;
    
    if (room.creatorId !== userId && req.user.role !== 'ADMIN') {
      throw new Error('Only creator or admin can view stats');
    }

    return this.statsService.getRoomStats(roomId, dto.period);
  }

  @Get('creator/dashboard')
  async getCreatorDashboard(@Request() req) {
    const userId = req.user.sub;
    const rooms = await this.roomsService.findByCreator(userId);
    const roomIds = rooms.map(r => r.id);
    
    const dashboard = await this.statsService.getCreatorDashboard(userId, roomIds);
    
    const totalMembers = await this.roomsService.getTotalMemberCount(roomIds);
    
    return { ...dashboard, totalMembers };
  }
}
