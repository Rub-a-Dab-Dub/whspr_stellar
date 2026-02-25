import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ConfigService } from './config.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/config')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async listAll() {
    return this.configService.getAll();
  }

  @Get('audit')
  async getAuditLog() {
    return this.configService.getAuditLog();
  }

  @Patch(':key')
  async updateConfig(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @Request() req,
  ) {
    return this.configService.update(
      key,
      dto.value,
      req.user.id,
      dto.description,
    );
  }
}
