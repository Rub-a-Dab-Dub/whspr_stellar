// src/notifications/notification-templates.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { NotificationTemplatesService } from './notification-templates.service';
import { AdminAuthGuard } from 'src/admin/auth/guards/admin-auth.guard';
import { User } from 'src/user/entities/user.entity';
import { CurrentAdmin } from 'src/AdminGuard and Role-based Access Control decorators';

@Controller('admin/notifications/templates')
@UseGuards(AdminAuthGuard)
export class NotificationTemplatesController {
  constructor(private readonly service: NotificationTemplatesService) {}

  @Get()
  list() {
    return this.service.listAll();
  }

  @Post()
  create(@CurrentAdmin() admin: User, @Body() body: any) {
    return this.service.create(admin, body);
  }

  @Patch(':templateId')
  update(@Param('templateId') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':templateId')
  delete(@Param('templateId') id: string) {
    return this.service.delete(id);
  }

  @Post(':templateId/preview')
  preview(
    @Param('templateId') id: string,
    @Body('variables') variables: Record<string, string>,
  ) {
    return this.service.preview(id, variables);
  }
}
