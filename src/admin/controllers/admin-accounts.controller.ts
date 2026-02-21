// src/admin/controllers/admin-accounts.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';

import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { Roles } from '../../roles/decorators/roles.decorator';
import { RoleGuard } from '../../roles/guards/role.guard';
import { UserRole } from '../../roles/entities/role.entity';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminAccountService } from '../services/admin-account.service';
import { InviteAdminDto } from '../dto/invite-admin.dto';
import { ChangeAdminRoleDto } from '../dto/change-admin-role.dto';
import { DeactivateAdminDto } from '../dto/deactivate-admin.dto';

@ApiTags('Admin – Admin Accounts')
@ApiBearerAuth()
@Controller('admin/admins')
@UseGuards(AdminJwtAuthGuard, RoleGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminAccountsController {
  constructor(private readonly adminAccountService: AdminAccountService) {}

  /**
   * GET /admin/admins
   * List all admin accounts (ADMIN, MODERATOR, SUPER_ADMIN).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all admin accounts' })
  @ApiResponse({
    status: 200,
    description:
      'Returns all admin team accounts with role, status, and last login',
  })
  async listAdmins(@CurrentUser() actor: any, @Req() req: Request) {
    return this.adminAccountService.listAdmins(actor.adminId, req);
  }

  /**
   * POST /admin/admins/invite
   * Creates an invite token and sends a setup email to the invitee.
   */
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new admin via email' })
  @ApiResponse({ status: 201, description: 'Invite sent successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async inviteAdmin(
    @Body() dto: InviteAdminDto,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.adminAccountService.inviteAdmin(
      dto.email,
      dto.role,
      actor.adminId,
      req,
    );
  }

  /**
   * PATCH /admin/admins/:adminId/role
   * Change the role of an admin account.
   */
  @Patch(':adminId/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change an admin role' })
  @ApiParam({ name: 'adminId', description: 'UUID of the target admin' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 403, description: 'Cannot demote yourself' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async changeRole(
    @Param('adminId') adminId: string,
    @Body() dto: ChangeAdminRoleDto,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.adminAccountService.changeRole(
      adminId,
      dto.role,
      dto.reason,
      actor.adminId,
      req,
    );
  }

  /**
   * POST /admin/admins/:adminId/deactivate
   * Deactivates an admin account and revokes all active sessions.
   */
  @Post(':adminId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate an admin account' })
  @ApiParam({ name: 'adminId', description: 'UUID of the target admin' })
  @ApiResponse({
    status: 200,
    description: 'Admin deactivated and sessions revoked',
  })
  @ApiResponse({ status: 403, description: 'Cannot deactivate yourself' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async deactivateAdmin(
    @Param('adminId') adminId: string,
    @Body() dto: DeactivateAdminDto,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.adminAccountService.deactivateAdmin(
      adminId,
      dto.reason,
      actor.adminId,
      req,
    );
  }

  /**
   * POST /admin/admins/:adminId/reactivate
   * Reactivates a previously deactivated admin account.
   */
  @Post(':adminId/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a deactivated admin account' })
  @ApiParam({ name: 'adminId', description: 'UUID of the target admin' })
  @ApiResponse({ status: 200, description: 'Admin reactivated' })
  @ApiResponse({ status: 400, description: 'Admin is not deactivated' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async reactivateAdmin(
    @Param('adminId') adminId: string,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return this.adminAccountService.reactivateAdmin(
      adminId,
      actor.adminId,
      req,
    );
  }
}
