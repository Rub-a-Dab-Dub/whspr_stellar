import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserSettingsService } from '../services/user-settings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UpdateSettingsDto, Confirm2FADto } from '../dto/update-settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class UserSettingsController {
  constructor(private readonly service: UserSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved' })
  async getSettings(@CurrentUser('id') userId: string) {
    return this.service.getSettings(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateSettings(@CurrentUser('id') userId: string, @Body() dto: UpdateSettingsDto) {
    return this.service.updateSettings(userId, dto);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset all settings to defaults' })
  @ApiResponse({ status: 200, description: 'Settings reset' })
  async resetSettings(@CurrentUser('id') userId: string) {
    return this.service.resetSettings(userId);
  }

  @Post('2fa/enable')
  @ApiOperation({ summary: 'Get 2FA secret and setup URL' })
  @ApiResponse({ status: 201, description: '2FA secret generated' })
  async enable2FA(@CurrentUser('id') userId: string) {
    return this.service.enable2FA(userId);
  }

  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm 2FA setup with a TOTP token' })
  @ApiResponse({ status: 200, description: '2FA enabled' })
  async confirm2FA(@CurrentUser('id') userId: string, @Body() dto: Confirm2FADto) {
    await this.service.confirm2FA(userId, dto.token);
    return { success: true };
  }

  @Delete('2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled' })
  async disable2FA(@CurrentUser('id') userId: string, @Body() dto: Confirm2FADto) {
    await this.service.disable2FA(userId, dto.token);
    return { success: true };
  }
}
