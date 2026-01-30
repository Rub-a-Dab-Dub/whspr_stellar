import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RoomMemberService } from './services/room-member.service';
import { MemberPermissionsService } from './services/member-permissions.service';
import { MemberActivityService } from './services/member-activity.service';
import {
  JoinRoomDto,
  KickMemberDto,
  UpdateMemberRoleDto,
  MembersListResponseDto,
} from './dto/room-member.dto';
import { MemberGuard } from './guards/member.guard';
import { RoomAdminGuard } from './guards/room-admin.guard';
import { RequirePermission } from './decorators/require-permission.decorator';
import { CurrentRoomMember } from './decorators/room-member.decorator';
import { MemberPermission } from './constants/room-member.constants';
import { RoomMember } from './entities/room-member.entity';
import { UserStatsService } from '../users/services/user-stats.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomMemberController {
  constructor(
    private memberService: RoomMemberService,
    private permissionsService: MemberPermissionsService,
    private activityService: MemberActivityService,
    private userStatsService: UserStatsService,
  ) {}

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  async joinRoom(
    @Param('id') roomId: string,
    @Body() dto: JoinRoomDto,
    @CurrentUser() user: any,
  ): Promise<RoomMember> {
    const member = await this.memberService.joinRoom(user.id, roomId, dto.inviteToken);
    await this.userStatsService.recordRoomJoined(user.id);
    return member;
  }

  @Post(':id/leave')
  @UseGuards(MemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveRoom(
    @Param('id') roomId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.memberService.leaveRoom(user.id, roomId);
  }

  @Get(':id/members')
  @UseGuards(MemberGuard)
  async getMembers(
    @Param('id') roomId: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 20,
    @Query('role') role?: string,
  ): Promise<MembersListResponseDto> {
    const { members, total } = await this.memberService.getMembers(roomId, skip, take, role as any);
    return {
      total,
      skip,
      take,
      members: members.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        userId: m.userId,
        user: m.user
          ? {
              id: m.user.id,
              username: m.user.username,
              email: m.user.email,
              avatar: m.user.avatar,
            }
          : undefined,
        role: m.role,
        status: m.status,
        permissions: m.permissions,
        joinedAt: m.joinedAt,
        lastActivityAt: m.lastActivityAt,
        createdAt: m.createdAt,
      })),
    };
  }

  @Delete(':id/members/:userId')
  @UseGuards(RoomAdminGuard)
  @RequirePermission(MemberPermission.KICK_MEMBERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  async kickMember(
    @Param('id') roomId: string,
    @Param('userId') userId: string,
    @Body() dto: KickMemberDto,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.memberService.kickMember(roomId, userId, user.id, dto.reason);
  }

  @Patch(':id/members/:userId/role')
  @UseGuards(RoomAdminGuard)
  @RequirePermission(MemberPermission.MANAGE_ROLES)
  async updateMemberRole(
    @Param('id') roomId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: any,
  ): Promise<RoomMember> {
    return await this.memberService.updateMemberRole(roomId, userId, dto.role, user.id);
  }

  @Get(':id/members/:userId/permissions')
  @UseGuards(MemberGuard)
  async getMemberPermissions(
    @Param('id') roomId: string,
    @Param('userId') userId: string,
  ): Promise<any> {
    const perms = await this.permissionsService.getMemberActions(userId, roomId);
    return perms;
  }

  @Get(':id/validate-capacity')
  @UseGuards(MemberGuard)
  async validateRoomCapacity(@Param('id') roomId: string): Promise<any> {
    return await this.memberService.validateMaxMembers(roomId);
  }

  @Post(':id/activity')
  @UseGuards(MemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordActivity(
    @Param('id') roomId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.activityService.recordActivity(user.id, roomId, 'MESSAGE_SENT' as any);
  }

  @Get(':id/activity/stats')
  @UseGuards(MemberGuard)
  async getActivityStats(
    @Param('id') roomId: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    return await this.activityService.getActivityStats(user.id, roomId);
  }

  @Get(':id/online-status')
  @UseGuards(MemberGuard)
  async getOnlineStatus(
    @Param('id') roomId: string,
    @Query('userIds') userIds: string[],
  ): Promise<any> {
    return await this.activityService.bulkGetOnlineStatus(roomId, userIds);
  }
}
