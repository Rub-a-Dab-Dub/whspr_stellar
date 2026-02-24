// src/maintenance/maintenance.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { MaintenanceService } from './maintainance.service';
import { AdminAuthGuard } from 'src/admin/auth/guards/admin-auth.guard';
import { CurrentAdmin } from 'src/AdminGuard and Role-based Access Control decorators';
import { User } from 'src/user/entities/user.entity';

@Controller('admin/maintenance')
@UseGuards(AdminAuthGuard)
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get()
  list() {
    return this.service.listAll();
  }

  @Get('active')
  getActive() {
    return this.service.getActive();
  }

  @Post()
  create(@CurrentAdmin() admin: User, @Body() body: any) {
    return this.service.create(admin, body);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Post(':id/end')
  end(@Param('id') id: string, @Body('actualEndNote') note?: string) {
    return this.service.end(id, note);
  }

  @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
