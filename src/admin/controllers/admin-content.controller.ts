import { Controller, Get, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { AdminContentService } from '../services/admin-content.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('admin/content')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminContentController {
  constructor(private readonly adminContentService: AdminContentService) {}

  @Get('messages')
  async getAllMessages(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.adminContentService.findAllMessages(limit || 100, offset || 0);
  }

  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string) {
    return this.adminContentService.deleteMessage(id);
  }
}
