import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../roles/guards/role.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { RequirePermissions } from '../roles/decorators/permissions.decorator';
import { RoleType } from '../roles/entities/role.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SystemConfigService } from './system-config.service';
import { SystemConfigPatchDto } from './dto/system-config-patch.dto';

@Controller('admin/config')
@UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard)
@Roles(RoleType.ADMIN)
@RequirePermissions('admin.access')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  async getConfigs(@Query('isFeatureFlag') isFeatureFlag?: string) {
    const parsedFlag =
      isFeatureFlag === undefined ? undefined : isFeatureFlag === 'true';
    return this.systemConfigService.getAllConfigs(parsedFlag);
  }

  @Patch()
  async updateConfig(
    @Body() body: SystemConfigPatchDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    if (body.updates && body.rollback) {
      throw new BadRequestException('Provide either updates or rollback, not both.');
    }

    if (!body.updates && !body.rollback) {
      throw new BadRequestException('Provide updates or rollback in request body.');
    }

    if (body.rollback) {
      const rolledBack = await this.systemConfigService.rollbackConfig(
        body.rollback.key,
        body.rollback.version,
        currentUser?.userId || null,
        req,
      );
      return { rollback: rolledBack };
    }

    const updated = await this.systemConfigService.updateConfigs(
      body.updates || [],
      currentUser?.userId || null,
      req,
    );
    return { updated };
  }
}
