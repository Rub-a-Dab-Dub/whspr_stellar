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
import { RoleType } from './entities/role.entity';
import { RoleGuard } from './guards/role.guard';
import { RolesService } from './services/roles.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

class AssignRoleDto {
  userId!: string;
  roleName!: RoleType;
}

@Controller('roles')
@UseGuards(JwtAuthGuard, RoleGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post('assign')
  @Roles(RoleType.ADMIN)
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
  @Roles(RoleType.ADMIN)
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
  @Roles(RoleType.ADMIN, RoleType.MODERATOR)
  async getUserRoles(@Param('userId') userId: string) {
    return this.rolesService.getUserRoles(userId);
  }

  @Get()
  @Roles(RoleType.ADMIN)
  async getAllRoles() {
    return this.rolesService.getAllRoles();
  }

  @Get(':name')
  @Roles(RoleType.ADMIN, RoleType.MODERATOR)
  async getRoleByName(@Param('name') name: RoleType) {
    return this.rolesService.getRoleByName(name);
  }
}
