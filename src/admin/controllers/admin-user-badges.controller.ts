import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Roles } from 'src/roles/decorators/roles.decorator';
import { UserRole } from 'src/roles/entities/user-role.enum';
import { GrantBadgeDto } from 'src/users/dto/grant-badge.dto';
import { RevokeBadgeDto } from 'src/users/dto/revoke-badge.dto';
import { UserBadgeService } from 'src/users/services/user-badge.service';
import { RolesGuard } from 'src/View, approve, and reject user withdrawal requests/roles.guard';

@Controller('admin/users/:userId/badges')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUserBadgesController {
  constructor(private readonly service: UserBadgeService) {}

  @Post()
  async grant(
    @Param('userId') userId: string,
    @Body() dto: GrantBadgeDto,
    @Req() req,
  ) {
    return this.service.grantBadge(
      userId,
      dto.badgeId,
      dto.reason,
      req.user.username,
    );
  }

  @Delete(':badgeId')
  async revoke(
    @Param('userId') userId: string,
    @Param('badgeId') badgeId: string,
    @Body() dto: RevokeBadgeDto,
    @Req() req,
  ) {
    return this.service.revokeBadge(
      userId,
      badgeId,
      dto.reason,
      req.user.username,
    );
  }

  @Get()
  async list(@Param('userId') userId: string) {
    return this.service.listUserBadges(userId);
  }
}
