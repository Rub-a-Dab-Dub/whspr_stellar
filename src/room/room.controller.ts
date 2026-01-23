import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RoomSettingsService } from './room.service';
import { UpdateRoomSettingsDto } from './dto/room-settings.dto';

@Controller('rooms/:roomId/settings')
export class RoomSettingsController {
  constructor(private settingsService: RoomSettingsService) {}

  @Get()
  async getSettings(@Param('roomId') roomId: string) {
    return this.settingsService.getOrCreateSettings(roomId);
  }

  @Patch()
  async updateSettings(
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomSettingsDto,
  ) {
    return this.settingsService.updateSettings(roomId, dto);
  }

  @Get('pinned')
  async getPinnedMessages(@Param('roomId') roomId: string) {
    return this.settingsService.getPinnedMessages(roomId);
  }

  @Post('pinned/:messageId')
  async pinMessage(
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.settingsService.pinMessage(roomId, messageId);
  }

  @Delete('pinned/:pinnedId')
  async unpinMessage(@Param('pinnedId') pinnedId: string) {
    await this.settingsService.unpinMessage(pinnedId);
    return { success: true };
  }
}
