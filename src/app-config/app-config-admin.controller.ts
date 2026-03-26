import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AppConfigService } from './app-config.service';
import { PatchAppConfigDto } from './dto/patch-app-config.dto';
import { BulkAppConfigDto } from './dto/bulk-app-config.dto';
import { AppConfigEntryDto, AppConfigMapResponseDto } from './dto/app-config-response.dto';

@ApiTags('admin / config')
@ApiBearerAuth()
@Controller('admin/config')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AppConfigAdminController {
  constructor(private readonly service: AppConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List all config entries (merged with defaults)' })
  @ApiResponse({ status: 200, type: AppConfigMapResponseDto })
  getAll(): Promise<AppConfigMapResponseDto> {
    return this.service.getAll();
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a single config key' })
  @ApiResponse({ status: 200, type: AppConfigEntryDto })
  patchOne(
    @Param('key') key: string,
    @Body() dto: PatchAppConfigDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ): Promise<AppConfigEntryDto> {
    const decodedKey = decodeURIComponent(key);
    return this.service.set(decodedKey, dto.value, {
      actorId: userId,
      ipAddress: this.clientIp(req),
      userAgent: this.userAgent(req),
    });
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Replace all registered config keys atomically' })
  @ApiResponse({ status: 200, type: AppConfigMapResponseDto })
  bulkReplace(
    @Body() dto: BulkAppConfigDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ): Promise<AppConfigMapResponseDto> {
    return this.service.bulkSet(dto.values, {
      actorId: userId,
      ipAddress: this.clientIp(req),
      userAgent: this.userAgent(req),
    });
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset all registered keys to default registry values' })
  @ApiResponse({ status: 200, type: AppConfigMapResponseDto })
  reset(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ): Promise<AppConfigMapResponseDto> {
    return this.service.resetToDefault({
      actorId: userId,
      ipAddress: this.clientIp(req),
      userAgent: this.userAgent(req),
    });
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Remove stored override (falls back to registry default)' })
  async deleteOne(
    @Param('key') key: string,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ): Promise<void> {
    const decodedKey = decodeURIComponent(key);
    await this.service.deleteKey(decodedKey, {
      actorId: userId,
      ipAddress: this.clientIp(req),
      userAgent: this.userAgent(req),
    });
  }

  private clientIp(req: Request): string | null {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string') {
      return xf.split(',')[0]?.trim() ?? null;
    }
    return req.ip ?? null;
  }

  private userAgent(req: Request): string | null {
    const ua = req.headers['user-agent'];
    return typeof ua === 'string' ? ua : null;
  }
}
