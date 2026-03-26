import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LocalizedParseUUIDPipe } from '../i18n/pipes/localized-parse-uuid.pipe';
import { PinMessageDto } from './dto/pin-message.dto';
import { PinnedMessageResponseDto } from './dto/pinned-message-response.dto';
import { ReorderPinnedDto } from './dto/reorder-pinned.dto';
import { PinnedMessagesService } from './pinned-messages.service';

@ApiTags('pinned-messages')
@ApiBearerAuth()
@Controller()
export class PinnedMessagesController {
  constructor(private readonly pinnedMessagesService: PinnedMessagesService) {}

  @Post('conversations/:id/pins')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Pin a message in a conversation' })
  @ApiResponse({ status: 201, type: PinnedMessageResponseDto })
  pinMessage(
    @Param('id', LocalizedParseUUIDPipe) conversationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: PinMessageDto,
  ): Promise<PinnedMessageResponseDto> {
    return this.pinnedMessagesService.pinMessage(conversationId, userId, dto);
  }

  @Get('conversations/:id/pins')
  @ApiOperation({ summary: 'List pinned messages' })
  @ApiResponse({ status: 200, type: [PinnedMessageResponseDto] })
  getPinnedMessages(
    @Param('id', LocalizedParseUUIDPipe) conversationId: string,
    @CurrentUser('id') userId: string,
  ): Promise<PinnedMessageResponseDto[]> {
    return this.pinnedMessagesService.getPinnedMessages(conversationId, userId);
  }

  @Delete('conversations/:id/pins/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unpin a message' })
  async unpinMessage(
    @Param('id', LocalizedParseUUIDPipe) conversationId: string,
    @Param('messageId', LocalizedParseUUIDPipe) messageId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.pinnedMessagesService.unpinMessage(conversationId, messageId, userId);
  }

  @Patch('conversations/:id/pins/reorder')
  @ApiOperation({ summary: 'Reorder pins (partial: listed message ids move to the front)' })
  @ApiResponse({ status: 200, type: [PinnedMessageResponseDto] })
  reorderPinned(
    @Param('id', LocalizedParseUUIDPipe) conversationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderPinnedDto,
  ): Promise<PinnedMessageResponseDto[]> {
    return this.pinnedMessagesService.reorderPinned(conversationId, userId, dto);
  }
}
