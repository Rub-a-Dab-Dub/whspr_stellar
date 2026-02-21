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
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../roles/guards/role.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { RequirePermissions } from '../roles/decorators/permissions.decorator';
import { RoleType } from '../roles/entities/role.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { GetUsersDto } from './dto/get-users.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { BulkActionDto } from './dto/bulk-action.dto';
import { ImpersonateUserDto } from './dto/impersonate-user.dto';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportsService } from './services/reports.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard)
@Roles(RoleType.ADMIN)
@RequirePermissions('user.manage')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly reportsService: ReportsService,
  ) {}

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
  async getUserActivity(@Param('id') userId: string) {
    return await this.adminService.getUserActivity(userId);
  }

  @Get('statistics')
  async getStatistics() {
    return await this.adminService.getUserStatistics();
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('adminId') adminId: string,
    @Query('targetUserId') targetUserId: string,
  ) {
    return await this.adminService.getAuditLogs(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      adminId,
      targetUserId,
    );
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

  @Post('reports/generate')
  @HttpCode(HttpStatus.OK)
  async generateReport(
    @Body() dto: GenerateReportDto,
    @CurrentUser() currentUser: any,
  ) {
    return await this.reportsService.generateReport(dto, currentUser.userId);
  }

  @Get('reports/:jobId/status')
  async getReportStatus(@Param('jobId') jobId: string) {
    return await this.reportsService.getJobStatus(jobId);
  }

  @Get('reports/:jobId/download')
  async downloadReport(
    @Param('jobId') jobId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, filename, contentType } = await this.reportsService.downloadReport(jobId);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(stream);
  }
}
