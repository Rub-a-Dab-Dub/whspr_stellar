import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { IsModeratorGuard } from '../guards/is-moderator.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../roles/guards/role.guard';
import { PermissionGuard } from '../../roles/guards/permission.guard';
import { Roles } from '../../roles/decorators/roles.decorator';
import { RequirePermissions } from '../../roles/decorators/permissions.decorator';
import { UserRole } from '../../roles/entities/role.entity';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminService } from '../services/admin.service';
import { GetUsersDto } from '../dto/get-users.dto';
import { GetRoomsDto } from '../dto/get-rooms.dto';
import { BanUserDto } from '../dto/ban-user.dto';
import { UnbanUserDto } from '../dto/unban-user.dto';
import { SuspendUserDto } from '../dto/suspend-user.dto';
import { BulkActionDto } from '../dto/bulk-action.dto';
import { ImpersonateUserDto } from '../dto/impersonate-user.dto';
import { GetAuditLogsDto } from '../dto/get-audit-logs.dto';
import { GetRevenueAnalyticsDto } from '../dto/get-revenue-analytics.dto';
import { GetOverviewAnalyticsDto } from '../dto/get-overview-analytics.dto';
import { GetRetentionAnalyticsDto } from '../dto/get-retention-analytics.dto';
import { GetTransactionsDto } from '../dto/get-transactions.dto';
import { IsAdmin } from '../decorators/is-admin.decorator';
import { DeleteUserDto } from '../dto/delete-user.dto';
import { UpdateConfigDto } from '../dto/update-config.dto';
import { GetRoomDetailsDto } from '../dto/get-room-details.dto';
import {
  LeaderboardCategory,
  LeaderboardPeriod,
} from '../../leaderboard/leaderboard.interface';
import { ResetLeaderboardDto } from '../dto/reset-leaderboard.dto';
import { SetPinnedDto } from '../dto/set-pinned.dto';
import { AdminLeaderboardQueryDto } from '../dto/admin-leaderboard-query.dto';
import { PlatformWalletService } from '../services/platform-wallet.service';
import { PlatformWalletWithdrawDto } from '../dto/platform-wallet-withdraw.dto';
import { GetWithdrawalsDto } from '../dto/get-withdrawals.dto';
import { CloseRoomDto } from '../dto/close-room.dto';
import { DeleteRoomDto } from '../dto/delete-room.dto';
import { RestoreRoomDto } from '../dto/restore-room.dto';
import { AdjustUserXpDto } from '../dto/adjust-user-xp.dto';

@ApiUseTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RoleGuard, PermissionGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly platformWalletService: PlatformWalletService,
  ) { }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ title: 'Admin API health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('users')
  @UseGuards(IsModeratorGuard)
  @ApiOperation({ title: 'List users with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async getUsers(
    @Query() query: GetUsersDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getUsers(query, currentUser.userId, req);
  }

  @Get('users/:id')
  @ApiOperation({ title: 'Get user detail by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserDetail(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getUserDetail(
      userId,
      currentUser.userId,
      req,
    );
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ title: 'Ban a user' })
  @ApiResponse({ status: 200, description: 'User banned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async banUser(
    @Param('id') userId: string,
    @Body() banDto: BanUserDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.banUser(
      userId,
      currentUser.userId,
      banDto,
      req,
    );
  }

  @Post('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ title: 'Unban a user' })
  @ApiResponse({ status: 200, description: 'User unbanned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unbanUser(
    @Param('id') userId: string,
    @Body() unbanDto: UnbanUserDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.unbanUser(
      userId,
      currentUser.userId,
      unbanDto,
      req,
    );
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ title: 'Suspend a user until a date' })
  @ApiResponse({ status: 200, description: 'User suspended successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async suspendUser(
    @Param('id') userId: string,
    @Body() suspendDto: SuspendUserDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.suspendUser(
      userId,
      currentUser.userId,
      suspendDto,
      req,
    );
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ title: 'Unsuspend a user' })
  @ApiResponse({ status: 200, description: 'User unsuspended successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unsuspendUser(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.unsuspendUser(
      userId,
      currentUser.userId,
      req,
    );
  }

  @Post('users/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ title: 'Verify a user' })
  @ApiResponse({ status: 200, description: 'User verified successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async verifyUser(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.verifyUser(userId, currentUser.userId, req);
  }

  @Post('users/:id/unverify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ title: 'Unverify a user' })
  @ApiResponse({ status: 200, description: 'User unverified successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unverifyUser(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.unverifyUser(
      userId,
      currentUser.userId,
      req,
    );
  }

  @Patch('users/:id/xp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjust user XP (exploit mitigation, compensation, etc.)' })
  @ApiResponse({ status: 200, description: 'XP adjusted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid XP adjustment (would go below 0)' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async adjustUserXp(
    @Param('id') userId: string,
    @Body() adjustXpDto: AdjustUserXpDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.adjustUserXp(
      userId,
      adjustXpDto,
      currentUser.userId,
      req,
    );
  }

  @Post('users/bulk-action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ title: 'Perform bulk action on multiple users' })
  @ApiResponse({ status: 200, description: 'Bulk action completed' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async bulkAction(
    @Body() bulkDto: BulkActionDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.bulkAction(bulkDto, currentUser.userId, req);
  }

  @Get('users/:id/activity')
  @ApiOperation({ title: 'Get user activity and audit history' })
  @ApiResponse({ status: 200, description: 'User activity data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserActivity(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getUserActivity(
      userId,
      currentUser.userId,
      req,
    );
  }

  @Get('users/:id/sessions')
  @ApiOperation({ title: 'Get user active sessions' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getUserSessions(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getUserSessions(
      userId,
      currentUser.userId,
      req,
    );
  }

  @Delete('users/:id/sessions/:sessionId')
  @ApiOperation({ title: 'Terminate specific user session' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async terminateSession(
    @Param('id') userId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.terminateSession(
      userId,
      sessionId,
      currentUser.userId,
      req,
    );
  }

  @Delete('users/:id/sessions')
  @ApiOperation({ title: 'Terminate all user sessions' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async terminateAllUserSessions(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.terminateAllUserSessions(
      userId,
      currentUser.userId,
      req,
    );
  }

  @Get('rooms')
  @Roles(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ title: 'Get rooms list with filters' })
  async getRooms(@Query() query: GetRoomsDto) {
    return await this.adminService.getRooms(query);
  }

  @Post('rooms/:roomId/close')
  @Roles(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a room (no new messages/members)' })
  @ApiResponse({ status: 200, description: 'Room closed successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async closeRoom(
    @Param('roomId') roomId: string,
    @Body() closeRoomDto: CloseRoomDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.closeRoom(
      roomId,
      closeRoomDto,
      currentUser.userId,
      req,
    );
  }

  @Delete('rooms/:roomId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a room and all its messages' })
  @ApiResponse({ status: 200, description: 'Room deleted successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deleteRoom(
    @Param('roomId') roomId: string,
    @Body() deleteRoomDto: DeleteRoomDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.deleteRoom(
      roomId,
      deleteRoomDto,
      currentUser.userId,
      req,
    );
  }

  @Post('rooms/:roomId/restore')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a closed or deleted room' })
  @ApiResponse({ status: 200, description: 'Room restored successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async restoreRoom(
    @Param('roomId') roomId: string,
    @Body() restoreRoomDto: RestoreRoomDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.restoreRoom(
      roomId,
      restoreRoomDto,
      currentUser.userId,
      req,
    );
  }

  @Get('statistics')
  @ApiOperation({ title: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'User statistics' })
  async getStatistics(@CurrentUser() currentUser: any, @Req() req: Request) {
    return await this.adminService.getUserStatistics(currentUser.userId, req);
  }

  @Get('audit-logs')
  @ApiOperation({ title: 'Get audit logs with filters' })
  @ApiResponse({ status: 200, description: 'Paginated audit logs' })
  async getAuditLogs(
    @Query() query: GetAuditLogsDto,
    @Query('adminId') adminId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    const actions = query.actions
      ? query.actions.split(',').map((action) => action.trim())
      : undefined;

    // Use adminId parameter if provided, otherwise use actorUserId from query
    const actorUserId = adminId || query.adminId || query.actorUserId;

    return await this.adminService.getAuditLogs(
      {
        ...query,
        actorUserId,
        actions,
      },
      currentUser.userId,
      req,
    );
  }

  @Get('audit-logs/export')
  @ApiOperation({ title: 'Export audit logs as CSV or JSON' })
  @ApiResponse({ status: 200, description: 'Audit log file download' })
  async exportAuditLogs(
    @Query() query: GetAuditLogsDto,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Query('adminId') adminId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const actions = query.actions
      ? query.actions.split(',').map((action) => action.trim())
      : undefined;

    // Use adminId parameter if provided, otherwise use actorUserId from query
    const actorUserId = adminId || query.adminId || query.actorUserId;

    const exportResult = await this.adminService.exportAuditLogs(
      {
        ...query,
        actorUserId,
        actions,
      },
      format,
      currentUser.userId,
      req,
    );

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-logs.${format}"`,
    );

    return exportResult.data;
  }

  @Get('users/:id/gdpr-export')
  @ApiOperation({ title: 'Export user data (GDPR)' })
  @ApiResponse({ status: 200, description: 'User data JSON download' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async exportGdprData(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.adminService.exportUserData(
      userId,
      currentUser.userId,
      req,
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gdpr-export-${userId}.json"`,
    );

    return data;
  }

  @Post('impersonate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('user.impersonate')
  @ApiOperation({ title: 'Start impersonation session' })
  @ApiResponse({ status: 200, description: 'Impersonation started' })
  @ApiResponse({
    status: 403,
    description: 'user.impersonate permission required',
  })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  async impersonateUser(
    @Body() impersonateDto: ImpersonateUserDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    // This would typically generate a special impersonation token
    // For now, we'll just log the action
    // In a real implementation, you'd want to create a special JWT token
    // that includes both the admin ID and the impersonated user ID
    const targetUser = await this.adminService.getUserDetail(
      impersonateDto.userId,
      currentUser.userId,
      req,
    );

    await this.adminService.logImpersonationStart(
      currentUser.userId,
      targetUser.id,
      req,
    );

    // Log impersonation start
    // In a real implementation, you'd store the impersonation session
    // and return a special token

    return {
      message: 'Impersonation started',
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
      },
      // In production, return a special impersonation token here
      // impersonationToken: await this.generateImpersonationToken(...)
    };
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ title: 'Delete user (super admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted and anonymized' })
  @ApiResponse({ status: 403, description: 'Super admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(
    @Param('id') userId: string,
    @Body() deleteDto: DeleteUserDto,
    @Query('force') force: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    const isForce = force === 'true';
    return await this.adminService.deleteUser(
      userId,
      deleteDto,
      currentUser.userId,
      isForce,
      req,
    );
  }

  @Get('config')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ title: 'Get all platform configs (super admin only)' })
  @ApiResponse({ status: 200, description: 'Platform configuration' })
  @ApiResponse({ status: 403, description: 'Super admin role required' })
  async getConfigs() {
    return await this.adminService.getConfigs();
  }

  @Patch('config/:key')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ title: 'Update platform config (super admin only)' })
  @ApiResponse({ status: 200, description: 'Config updated' })
  @ApiResponse({ status: 403, description: 'Super admin role required' })
  @ApiResponse({ status: 404, description: 'Config key not found' })
  async updateConfig(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.updateConfig(
      key,
      dto,
      currentUser.userId,
      req,
    );
  }

  @Get('analytics/revenue')
  @ApiOperation({ title: 'Get revenue analytics' })
  @ApiResponse({ status: 200, description: 'Revenue analytics' })
  async getRevenueAnalytics(
    @Query() query: GetRevenueAnalyticsDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getRevenueAnalytics(
      query,
      currentUser.userId,
      req,
    );
  }

  @Get('analytics/overview')
  @ApiOperation({ title: 'Get platform overview analytics' })
  async getOverviewAnalytics(
    @Query() query: GetOverviewAnalyticsDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getOverviewAnalytics(
      query,
      currentUser.userId,
      req,
    );
  }

  @Get('analytics/retention')
  @ApiOperation({ summary: 'Get cohort retention analytics' })
  @ApiResponse({ status: 200, description: 'Cohort retention analytics' })
  async getRetentionAnalytics(
    @Query() query: GetRetentionAnalyticsDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getRetentionCohortAnalytics(
      query,
      currentUser.userId,
      req,
    );
  @Get('transactions')
  @ApiOperation({ title: 'Get on-chain transactions ledger (paginated & filterable)' })
  @ApiResponse({ status: 200, description: 'Paginated transactions list' })
  async getTransactions(
    @Query() query: GetTransactionsDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getTransactions(query, currentUser.userId, req);
  }

  @Get('leaderboards')
  @ApiOperation({ title: 'Get available leaderboard types' })
  @ApiResponse({ status: 200, description: 'List of leaderboard categories' })
  async getLeaderboardTypes() {
    return await this.adminService.getLeaderboardTypes();
  }

  @Get('leaderboards/:type')
  @ApiOperation({ title: 'Get leaderboard entries' })
  @ApiResponse({ status: 200, description: 'Leaderboard entries' })
  async getLeaderboardEntries(
    @Param('type') type: LeaderboardCategory,
    @Query() query: AdminLeaderboardQueryDto,
  ) {
    return await this.adminService.getLeaderboardEntries(type, query);
  }

  @Post('leaderboards/:type/reset')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ title: 'Reset leaderboard (super admin only)' })
  @ApiResponse({ status: 200, description: 'Leaderboard reset successfully' })
  @ApiResponse({ status: 403, description: 'Super admin role required' })
  async resetLeaderboard(
    @Param('type') type: LeaderboardCategory,
    @Query('period') period: LeaderboardPeriod,
    @Body() dto: ResetLeaderboardDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.resetLeaderboard(
      type,
      period,
      dto,
      currentUser.userId,
      req,
    );
  }

  @Get('leaderboards/history')
  @ApiOperation({ title: 'Get leaderboard reset history' })
  @ApiResponse({ status: 200, description: 'Leaderboard history snapshots' })
  async getLeaderboardHistory(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return await this.adminService.getLeaderboardHistory(
      Number(page),
      Number(limit),
    );
  }

  @Post('leaderboards/pin')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ title: 'Pin/unpin user on leaderboard (super admin only)' })
  @ApiResponse({ status: 200, description: 'Pinned status updated' })
  @ApiResponse({ status: 403, description: 'Super admin role required' })
  async setPinnedStatus(
    @Body() dto: SetPinnedDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.setLeaderboardPinned(
      dto,
      currentUser.userId,
      req,
    );
  }

  @Post('users/:userId/reset-password')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async resetUserPassword(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.adminResetPassword(
      userId,
      currentUser.userId,
      req,
    );
  }

  @Get('rooms/:roomId')
  @ApiOperation({ title: 'Get room details' })
  async getRoomDetails(
    @Param('roomId') roomId: string,
    @Query() query: GetRoomDetailsDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  @Param('roomId') roomId: string,
  @Query() query: any,
  @CurrentUser() currentUser: any,
  @Req() req: Request,
  ) {
    return await this.adminService.getRoomDetails(
      roomId,
      query,
      currentUser.userId,
      req,
    );
  }

  @Get('platform-wallet')
  @ApiOperation({ title: 'Get platform wallet information' })
  @ApiResponse({ status: 200, description: 'Platform wallet info' })
  async getPlatformWallet(@CurrentUser() currentUser: any) {
    return await this.platformWalletService.getPlatformWalletInfo();
  }

  @Post('platform-wallet/withdraw')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ title: 'Initiate platform wallet withdrawal (super admin only)' })
  @ApiResponse({ status: 200, description: 'Withdrawal initiated' })
  @ApiResponse({ status: 403, description: 'Super admin role required' })
  async withdrawFromPlatformWallet(
    @Body() withdrawDto: PlatformWalletWithdrawDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.platformWalletService.initiateWithdrawal(
      withdrawDto,
      currentUser.userId,
      req,
    );
  }

  @Get('platform-wallet/withdrawals')
  @ApiOperation({ title: 'Get platform wallet withdrawal history' })
  @ApiResponse({ status: 200, description: 'Withdrawal history' })
  async getWithdrawals(@Query() query: GetWithdrawalsDto) {
    return await this.platformWalletService.getWithdrawals(query);
  }

  @Post('transactions/:txId/refund')
  async refundTransaction(
    @Param('txId') txId: string,
    @Body() dto: RefundTransactionDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return this.adminService.refundTransaction(txId, dto, currentUser.id, req);
  }

}
