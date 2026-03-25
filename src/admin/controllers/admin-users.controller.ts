import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { AdminUsersService } from '../services/admin-users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { UserTier } from '../../users/entities/user.entity';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  async getAllUsers() {
    return this.adminUsersService.findAll();
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Patch(':id/status')
  async setStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.adminUsersService.setStatus(id, !!isActive);
  }

  @Patch(':id/tier')
  async setTier(@Param('id') id: string, @Body('tier') tier: UserTier) {
    return this.adminUsersService.setTier(id, tier);
  }
}
