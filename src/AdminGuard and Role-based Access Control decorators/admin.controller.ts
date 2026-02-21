import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminRoles } from './decorators/admin-roles.decorator';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminRole } from './enums/admin-role.enum';
import { AdminGuard } from './guards/admin.guard';
import { AdminRolesGuard } from './guards/admin-roles.guard';

/**
 * Example admin controller demonstrating composable guard usage.
 *
 * Pattern:
 *   @UseGuards(AdminGuard, AdminRolesGuard)   ← applies to whole controller
 *   @AdminRoles(AdminRole.X)                  ← per-route role requirement
 */
@Controller('admin')
@UseGuards(AdminGuard, AdminRolesGuard)
export class AdminController {
  /**
   * Any authenticated admin can read the dashboard.
   * No @AdminRoles() → AdminRolesGuard allows all authenticated admins.
   */
  @Get('dashboard')
  getDashboard(@CurrentAdmin() admin: any) {
    return { message: 'Welcome to the dashboard', admin };
  }

  /**
   * Only ADMIN or SUPER_ADMIN can manage content.
   */
  @Get('users')
  @AdminRoles(AdminRole.ADMIN)
  listUsers() {
    return { message: 'User list' };
  }

  /**
   * Moderators and above can review flagged content.
   */
  @Patch('content/:id/approve')
  @AdminRoles(AdminRole.MODERATOR)
  approveContent(@Param('id') id: string) {
    return { message: `Content ${id} approved` };
  }

  /**
   * Only SUPER_ADMIN can delete admins.
   */
  @Delete('admins/:id')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  deleteAdmin(@Param('id') id: string) {
    return { message: `Admin ${id} deleted` };
  }

  /**
   * System settings — SUPER_ADMIN only.
   */
  @Patch('settings')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  updateSettings() {
    return { message: 'Settings updated' };
  }
}
