import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../../roles/decorators/roles.decorator';
import { RoleGuard } from '../../roles/guards/role.guard';
import { UserRole } from '../../roles/entities/role.entity';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { SystemService } from './system.service';
import { SystemLogsQueryDto } from './dto/system-logs-query.dto';
import { ClearFailedJobsDto } from './dto/clear-failed-jobs.dto';

@Controller('admin/system')
@UseGuards(AdminJwtAuthGuard, RoleGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('health')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getHealth() {
    return await this.systemService.getSystemHealth();
  }

  @Get('queues')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getQueues() {
    return await this.systemService.getQueueDetails();
  }

  @Post('queues/:queueName/failed/retry-all')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async retryAllFailed(
    @Param('queueName') queueName: string,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    return await this.systemService.retryAllFailed(
      queueName,
      actor.adminId,
      req,
    );
  }

  @Delete('queues/:queueName/failed')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async clearFailed(
    @Param('queueName') queueName: string,
    @Body() body: ClearFailedJobsDto,
    @CurrentUser() actor: any,
    @Req() req: Request,
  ) {
    if (!body.confirm) {
      throw new BadRequestException(
        'Set { "confirm": true } to clear failed jobs',
      );
    }

    return await this.systemService.clearFailed(queueName, actor.adminId, req);
  }

  @Get('logs')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getLogs(@Query() query: SystemLogsQueryDto) {
    return await this.systemService.getSystemLogs(query);
  }
}
