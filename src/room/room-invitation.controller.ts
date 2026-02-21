import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RoomInvitationService } from './services/room-invitation.service';
import {
  InviteMemberDto,
  InvitationResponseDto,
  ResendInvitationDto,
  PendingInvitationsDto,
} from './dto/room-invitation.dto';
import { MemberGuard } from './guards/member.guard';
import { RoomAdminGuard } from './guards/room-admin.guard';
import { RequirePermission } from './decorators/require-permission.decorator';
import { MemberPermission } from './constants/room-member.constants';
import { RoomInvitation } from './entities/room-invitation.entity';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomInvitationController {
  constructor(private invitationService: RoomInvitationService) {}

  @Post(':id/invite')
  @UseGuards(MemberGuard)
  @RequirePermission(MemberPermission.INVITE_MEMBERS)
  async inviteMembers(
    @Param('id') roomId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: any,
  ): Promise<RoomInvitation[]> {
    return await this.invitationService.inviteMembers(
      roomId,
      dto.userIds,
      user.id,
      dto.message,
    );
  }

  @Get('invitations/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingInvitations(
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 20,
    @CurrentUser() user: any,
  ): Promise<PendingInvitationsDto> {
    const { invitations, total } =
      await this.invitationService.getPendingInvitations(user.id, skip, take);
    return {
      total,
      skip,
      take,
      invitations: invitations.map((i) => ({
        id: i.id,
        roomId: i.roomId,
        roomName: i.room?.name,
        roomDescription: i.room?.description,
        room: i.room,
        invitedById: i.invitedById,
        invitedBy: {
          id: i.invitedBy?.id,
          username: i.invitedBy?.username,
          avatar: i.invitedBy?.avatar,
        },
        invitedUserId: i.invitedUserId,
        invitedEmail: i.invitedEmail,
        status: i.status,
        message: i.message,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
        acceptedAt: i.acceptedAt,
        rejectedAt: i.rejectedAt,
        inviteToken: i.inviteToken,
      })) as any,
    };
  }

  @Patch('invitations/:invitationId/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    const member = await this.invitationService.acceptInvitation(
      invitationId,
      user.id,
    );
    return {
      message: 'Invitation accepted',
      member,
    };
  }

  @Patch('invitations/:invitationId/reject')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async rejectInvitation(
    @Param('invitationId') invitationId: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    await this.invitationService.rejectInvitation(
      invitationId,
      user.id,
      reason,
    );
    return { message: 'Invitation rejected' };
  }

  @Get('invitations/:invitationId')
  @UseGuards(JwtAuthGuard)
  async getInvitationDetails(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: any,
  ): Promise<RoomInvitation> {
    const invitation =
      await this.invitationService.getInvitationByToken(invitationId);
    return invitation;
  }

  @Post('invitations/:invitationId/resend')
  @UseGuards(JwtAuthGuard)
  async resendInvitation(
    @Param('invitationId') invitationId: string,
    @Body() dto: ResendInvitationDto,
    @CurrentUser() user: any,
  ): Promise<RoomInvitation> {
    return await this.invitationService.resendInvitation(
      invitationId,
      user.id,
      dto.message,
    );
  }

  @Delete('invitations/:invitationId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.invitationService.revokeInvitation(invitationId, user.id);
  }

  @Get(':id/invitations')
  @UseGuards(RoomAdminGuard)
  @RequirePermission(MemberPermission.MANAGE_INVITATIONS)
  async getRoomInvitations(
    @Param('id') roomId: string,
    @Query('status') status?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 20,
  ): Promise<any> {
    const { invitations, total } =
      await this.invitationService.getRoomInvitations(
        roomId,
        status as any,
        skip,
        take,
      );
    return { total, skip, take, invitations };
  }
}
