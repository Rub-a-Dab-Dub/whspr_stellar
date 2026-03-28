import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserSettingsResponseDto } from './dto/user-settings-response.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { UserSettingsService } from './user-settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class UserSettingsController {
  constructor(private readonly service: UserSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user settings' })
  @ApiResponse({ status: 200, type: UserSettingsResponseDto })
  getSettings(@CurrentUser('id') userId: string): Promise<UserSettingsResponseDto> {
    return this.service.getSettings(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user settings' })
  @ApiResponse({ status: 200, type: UserSettingsResponseDto })
  updateSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserSettingsDto,
  ): Promise<UserSettingsResponseDto> {
    return this.service.updateSettings(userId, dto);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset settings to defaults' })
  @ApiResponse({ status: 200, type: UserSettingsResponseDto })
  resetSettings(@CurrentUser('id') userId: string): Promise<UserSettingsResponseDto> {
    return this.service.resetSettings(userId);
  }
}
