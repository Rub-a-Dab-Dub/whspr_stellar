// src/roles/controllers/roles.controller.ts
import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from './entities/role.entity';
import { RoleGuard } from './guards/role.guard';
import { RolesService } from './services/roles.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

class AssignRoleDto {
  userId!: string;
  roleName!: UserRole;
}

@Controller('roles')
@UseGuards(JwtAuthGuard, RoleGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post('assign')
  @Roles(UserRole.ADMIN)
  async assignRole(
    @Body() dto: AssignRoleDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return this.rolesService.assignRoleToUser(
      dto.userId,
      dto.roleName,
      currentUser.userId,
      req,
    );
  }

  @Delete('revoke')
  @Roles(UserRole.ADMIN)
  async revokeRole(
    @Body() dto: AssignRoleDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return this.rolesService.revokeRoleFromUser(
      dto.userId,
      dto.roleName,
      currentUser.userId,
      req,
    );
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getUserRoles(@Param('userId') userId: string) {
    return this.rolesService.getUserRoles(userId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async getAllRoles() {
    return this.rolesService.getAllRoles();
  }

  @Get(':name')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getRoleByName(@Param('name') name: UserRole) {
    return this.rolesService.getRoleByName(name);
  }
}
