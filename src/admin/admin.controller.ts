import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { SetUserActiveDto } from './dto/set-user-active.dto';

/**
 * AdminController — all routes on this controller require the ADMIN role.
 *
 * The @Roles(UserRole.ADMIN) on the class applies to every handler.
 * Individual handlers may layer additional @Roles() for finer control.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly usersService: UserService) {}

  // ─── User management ────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: '[ADMIN] List all users' })
  @ApiResponse({ status: 200, description: 'User list returned' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  async listUsers(@CurrentUser() admin: JwtPayload) {
    return this.usersService.findAll();
  }

  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "[ADMIN] Update a user's role" })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.updateRole(id, dto.role);
  }

  @Patch('users/:id/active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Activate or deactivate a user account' })
  @ApiResponse({ status: 200, description: 'User active status updated' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  async setUserActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserActiveDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.setActive(id, dto.isActive);
  }

  // ─── Mixed-role example: ADMIN and MODERATOR can view reports ───────────────

  @Get('reports')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR) // overrides class-level ADMIN-only
  @ApiOperation({ summary: '[ADMIN | MODERATOR] View moderation reports' })
  @ApiResponse({ status: 200, description: 'Reports returned' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or MODERATOR role' })
  getReports(@CurrentUser() user: JwtPayload) {
    // Placeholder — wire to real reporting service when available
    return {
      requestedBy: user.sub,
      requestedByRole: user.role,
      reports: [],
    };
  }
}
