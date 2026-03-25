import { Controller, Get, Param, Post, Body, Patch, Delete, UseGuards } from '@nestjs/common';
import { AdminSettingsService } from '../services/admin-settings.service';
import { CreateSystemSettingDto, UpdateSystemSettingDto } from '../dto/system-setting.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  async getAllSettings() {
    return this.adminSettingsService.findAll();
  }

  @Get(':key')
  async getSetting(@Param('key') key: string) {
    return this.adminSettingsService.findOne(key);
  }

  @Post()
  async createOrUpdateSetting(@Body() createDto: CreateSystemSettingDto) {
    return this.adminSettingsService.createOrUpdate(createDto);
  }

  @Patch(':key')
  async updateSetting(@Param('key') key: string, @Body() updateDto: UpdateSystemSettingDto) {
    return this.adminSettingsService.update(key, updateDto);
  }

  @Delete(':key')
  async deleteSetting(@Param('key') key: string) {
    return this.adminSettingsService.remove(key);
  }
}
