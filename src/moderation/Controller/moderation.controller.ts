import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { RoomModerationSettings } from './entities/room-moderation-settings.entity';
import { FlaggedMessage } from './entities/flagged-message.entity';

@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('queue')
  async getReviewQueue(@Query('roomId') roomId?: string) {
    return await this.moderationService.getReviewQueue(roomId);
  }

  @Post('report')
  async reportMessage(
    @Body()
    body: {
      messageId: string;
      roomId: string;
      userId: string;
      content: string;
      reason: string;
      reportedBy: string;
    },
  ) {
    return await this.moderationService.reportMessage(body);
  }

  @Put('review/:flaggedId')
  async reviewMessage(
    @Param('flaggedId') flaggedId: string,
    @Body()
    body: {
      reviewerId: string;
      approved: boolean;
      notes?: string;
    },
  ) {
    return await this.moderationService.reviewFlaggedMessage(
      flaggedId,
      body.reviewerId,
      body.approved,
      body.notes,
    );
  }

  @Get('settings/:roomId')
  async getSettings(@Param('roomId') roomId: string) {
    return await this.moderationService.updateSettings(roomId, {});
  }

  @Put('settings/:roomId')
  async updateSettings(
    @Param('roomId') roomId: string,
    @Body() updates: Partial<RoomModerationSettings>,
  ) {
    return await this.moderationService.updateSettings(roomId, updates);
  }

  @Get('actions/:userId')
  async getUserActions(
    @Param('userId') userId: string,
    @Query('roomId') roomId?: string,
  ) {
    return await this.moderationService.getUserActions(userId, roomId);
  }
}
