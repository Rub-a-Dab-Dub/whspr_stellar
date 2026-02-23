import {
  Controller,
  Get,
  Param,
  Delete,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { RoleGuard } from '../../roles/guards/role.guard';
import { Roles } from '../../roles/decorators/roles.decorator';
import { UserRole } from '../../roles/entities/role.entity';
import { RateLimitsService } from '../services/rate-limits.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

class ResetDto {
  reason?: string;
}

@ApiTags('admin-rate-limits')
@ApiBearerAuth()
@UseGuards(RoleGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/rate-limits')
export class RateLimitsController {
  constructor(private readonly svc: RateLimitsService) {}

  @Get('users/:userId')
  @ApiOperation({ summary: 'List active rate limit buckets for a user' })
  async getUser(@Param('userId') userId: string) {
    return this.svc.getUserBuckets(userId);
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'Reset all rate limit buckets for a user' })
  async resetAll(
    @Param('userId') userId: string,
    @Body() body: ResetDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    const actor = currentUser?.adminId || currentUser?.userId || currentUser?.id;
    return this.svc.resetAllUserBuckets(userId, actor, body?.reason);
  }

  @Delete('users/:userId/:key')
  @ApiOperation({ summary: 'Reset a specific rate limit bucket for a user' })
  async resetKey(
    @Param('userId') userId: string,
    @Param('key') key: string,
    @Body() body: ResetDto,
    @CurrentUser() currentUser: any,
  ) {
    const actor = currentUser?.adminId || currentUser?.userId || currentUser?.id;
    // key is expected to be the literal redis key; clients may need to URL-encode
    return this.svc.resetUserBucket(userId, key, actor, body?.reason);
  }

  @Get('top-blocked')
  @ApiOperation({ summary: 'Top 20 users currently blocked by rate limits' })
  async topBlocked() {
    return this.svc.getTopBlocked(20);
  }

  @Get('config')
  @ApiOperation({ summary: 'Rate limit configuration for action types' })
  async config() {
    return this.svc.getConfig();
  }
}
