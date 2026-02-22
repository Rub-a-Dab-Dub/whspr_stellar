// src/admin/auth/admin-auth.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRefreshTokenDto } from './dto/admin-refresh-token.dto';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminJwtRefreshGuard } from './guards/admin-jwt-refresh.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

/** All admin auth endpoints are rate-limited to 20 requests/min per IP */
@ApiTags('Admin Auth')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  /**
   * POST /admin/auth/login
   * Authenticates an admin user and returns a short-lived access token.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({
    status: 200,
    description: 'Returns admin access token',
    schema: {
      example: {
        access_token: 'eyJ...',
        expires_in: 7200,
        admin: { id: 'uuid', email: 'admin@example.com', role: 'admin' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Insufficient privileges' })
  async login(@Body() loginDto: AdminLoginDto, @Req() req: Request) {
    return this.adminAuthService.login(loginDto.email, loginDto.password, req);
  }

  /**
   * POST /admin/auth/refresh
   * Issues a new access token using a valid admin refresh token.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminJwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh admin access token' })
  @ApiResponse({ status: 200, description: 'New access token issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Body() _dto: AdminRefreshTokenDto, // validated by guard
    @CurrentUser() admin: any,
    @Req() req: Request,
  ) {
    return this.adminAuthService.refresh(
      admin.adminId,
      admin.email,
      admin.role,
      req,
    );
  }

  /**
   * POST /admin/auth/logout
   * Invalidates the current admin access token and refresh token.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin logout' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@CurrentUser() admin: any, @Req() req: Request) {
    return this.adminAuthService.logout(admin.adminId, admin.jti, req);
  }
}
