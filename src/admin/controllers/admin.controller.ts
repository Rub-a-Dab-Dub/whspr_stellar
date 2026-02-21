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
import { Request, Response } from 'express';
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
import { SuspendUserDto } from '../dto/suspend-user.dto';
import { BulkActionDto } from '../dto/bulk-action.dto';
import { ImpersonateUserDto } from '../dto/impersonate-user.dto';
import { GetAuditLogsDto } from '../dto/get-audit-logs.dto';
import { GetRevenueAnalyticsDto } from '../dto/get-revenue-analytics.dto';
import { IsAdmin } from '../decorators/is-admin.decorator';
import { DeleteUserDto } from '../dto/delete-user.dto';
import { UpdateConfigDto } from '../dto/update-config.dto';
import { LeaderboardCategory, LeaderboardPeriod } from '../../leaderboard/leaderboard.interface';
import { ResetLeaderboardDto } from '../dto/reset-leaderboard.dto';
import { SetPinnedDto } from '../dto/set-pinned.dto';

@Controller('admin')
@IsAdmin()
@UseGuards(RoleGuard, PermissionGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('users')
  async getUsers(
    @Query() query: GetUsersDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getUsers(query, currentUser.userId, req);
  }

  @Get('users/:id')
  async getUserDetail(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getUserDetail(userId, currentUser.userId, req);
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  async banUser(
    @Param('id') userId: string,
    @Body() banDto: BanUserDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.banUser(userId, currentUser.userId, banDto, req);
  }

  @Post('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  async unbanUser(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.unbanUser(userId, currentUser.userId, req);
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendUser(
    @Param('id') userId: string,
    @Body() suspendDto: SuspendUserDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.suspendUser(userId, currentUser.userId, suspendDto, req);
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  async unsuspendUser(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.unsuspendUser(userId, currentUser.userId, req);
  }

  @Post('users/:id/verify')
  @HttpCode(HttpStatus.OK)
  async verifyUser(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.verifyUser(userId, currentUser.userId, req);
  }

  @Post('users/:id/unverify')
  @HttpCode(HttpStatus.OK)
  async unverifyUser(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.unverifyUser(userId, currentUser.userId, req);
  }

  @Post('users/bulk-action')
  @HttpCode(HttpStatus.OK)
  async bulkAction(
    @Body() bulkDto: BulkActionDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.bulkAction(bulkDto, currentUser.userId, req);
  }

  @Get('users/:id/activity')
  async getUserActivity(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getUserActivity(userId, currentUser.userId, req);
  }

  @Get('users/:id/sessions')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getUserSessions(
    @Param('id') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.getUserSessions(userId);
  }

  @Delete('users/:id/sessions/:sessionId')
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
  async getRooms(@Query() query: GetRoomsDto) {
    return await this.adminService.getRooms(query);
  }

  @Get('statistics')
  async getStatistics(@CurrentUser() currentUser: any, @Req() req: Request) {
    return await this.adminService.getUserStatistics(currentUser.userId, req);
  }

  @Get('audit-logs')
  @Roles(UserRole.SUPER_ADMIN)
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
  @Roles(UserRole.SUPER_ADMIN)
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
  async getConfigs() {
    return await this.adminService.getConfigs();
  }

  @Patch('config/:key')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
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

  @Get('leaderboards')
  async getLeaderboardTypes() {
    return await this.adminService.getLeaderboardTypes();
  }

  @Get('leaderboards/:type')
  async getLeaderboardEntries(
    @Param('type') type: LeaderboardCategory,
    @Query() query: { period?: LeaderboardPeriod; roomId?: string; page?: number; limit?: number },
  ) {
    return await this.adminService.getLeaderboardEntries(type, query);
  }

  @Post('leaderboards/:type/reset')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
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
  async getLeaderboardHistory(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return await this.adminService.getLeaderboardHistory(Number(page), Number(limit));
  }

  @Post('leaderboards/pin')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  async setPinnedStatus(
    @Body() dto: SetPinnedDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return await this.adminService.setLeaderboardPinned(dto, currentUser.userId, req);
  }
}
