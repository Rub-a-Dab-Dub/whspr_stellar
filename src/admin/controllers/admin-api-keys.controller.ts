import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { AdminApiKeysService } from '../services/admin-api-keys.service';
import { CurrentAdmin } from 'src/AdminGuard and Role-based Access Control decorators';

@Controller('admin/api-keys')
@UseGuards(AdminAuthGuard)
export class AdminApiKeysController {
  constructor(private readonly service: AdminApiKeysService) {}

  @Post()
  create(@CurrentAdmin() admin, @Body() dto: any) {
    return this.service.create(admin, dto);
  }

  @Get()
  list(@CurrentAdmin() admin) {
    return this.service.listForAdmin(admin);
  }

  @Delete(':id')
  revoke(@Param('id') id: string, @CurrentAdmin() admin) {
    return this.service.revoke(id, admin);
  }
}
