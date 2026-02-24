import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Roles } from 'src/roles/decorators/roles.decorator';
import { UserRole } from 'src/roles/entities/user-role.enum';
import { CreateBadgeDto } from '../dto/create-badge.dto';
import { UpdateBadgeDto } from '../dto/update-badge.dto';
import { GetBadgesDto } from '../dto/get-badges.dto';
import { AdminBadgesService } from '../services/admin-badges.service';
import { RolesGuard } from 'src/View, approve, and reject user withdrawal requests/roles.guard';

@Controller('admin/badges')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminBadgesController {
  constructor(private readonly service: AdminBadgesService) {}

  @Get()
  async list(@Query() query: GetBadgesDto) {
    return this.service.getBadges(query);
  }

  @Get(':badgeId')
  async detail(@Param('badgeId') badgeId: string) {
    return this.service.getBadgeById(badgeId);
  }

  @Post()
  async create(@Body() dto: CreateBadgeDto, @Req() req) {
    return this.service.createBadge(dto, req.user.id, req);
  }

  @Patch(':badgeId')
  async update(@Param('badgeId') badgeId: string, @Body() dto: UpdateBadgeDto, @Req() req) {
    return this.service.updateBadge(badgeId, dto, req.user.id, req);
  }

  @Patch(':badgeId/toggle')
  async toggle(@Param('badgeId') badgeId: string, @Req() req) {
    return this.service.toggleBadge(badgeId, req.user.id, req);
  }

  @Delete(':badgeId')
  async remove(@Param('badgeId') badgeId: string, @Req() req) {
    return this.service.deleteBadge(badgeId, req.user.id, req);
  }
}
