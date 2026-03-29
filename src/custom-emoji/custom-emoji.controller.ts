import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ConfirmEmojiUploadDto,
  CustomEmojiResponseDto,
  EmojiSearchQueryDto,
  PresignEmojiResponseDto,
  PresignEmojiUploadDto,
} from './dto/custom-emoji.dto';
import { CustomEmojiService } from './custom-emoji.service';

@ApiTags('custom-emoji')
@ApiBearerAuth()
@Controller()
export class CustomEmojiController {
  constructor(private readonly service: CustomEmojiService) {}

  @Post('groups/:id/emoji/presign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate a presigned upload URL for a custom emoji (admin/mod only)' })
  @ApiResponse({ status: 201, type: PresignEmojiResponseDto })
  presign(
    @CurrentUser('id') userId: string,
    @CurrentUser('groupRole') groupRole: string,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: PresignEmojiUploadDto,
  ): Promise<PresignEmojiResponseDto> {
    return this.service.generateUploadUrl(userId, groupId, groupRole ?? 'member', dto);
  }

  @Post('groups/:id/emoji/confirm')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Confirm emoji upload and persist record (admin/mod only)' })
  @ApiResponse({ status: 201, type: CustomEmojiResponseDto })
  confirm(
    @CurrentUser('id') userId: string,
    @CurrentUser('groupRole') groupRole: string,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: ConfirmEmojiUploadDto,
  ): Promise<CustomEmojiResponseDto> {
    return this.service.confirmUpload(userId, groupId, groupRole ?? 'member', dto);
  }

  @Get('groups/:id/emoji')
  @ApiOperation({ summary: 'List all active custom emoji for a group' })
  @ApiResponse({ status: 200, type: [CustomEmojiResponseDto] })
  getGroupEmoji(
    @Param('id', ParseUUIDPipe) groupId: string,
  ): Promise<CustomEmojiResponseDto[]> {
    return this.service.getGroupEmoji(groupId);
  }

  @Delete('groups/:id/emoji/:emojiId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom emoji (admin/mod only)' })
  deleteEmoji(
    @CurrentUser('id') userId: string,
    @CurrentUser('groupRole') groupRole: string,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('emojiId', ParseUUIDPipe) emojiId: string,
  ): Promise<void> {
    return this.service.deleteEmoji(userId, groupId, emojiId, groupRole ?? 'member');
  }

  @Get('emoji/search')
  @ApiOperation({ summary: 'Search custom emoji by name, optionally scoped to a group' })
  @ApiResponse({ status: 200 })
  searchEmoji(
    @Query() query: EmojiSearchQueryDto,
  ): Promise<{ data: CustomEmojiResponseDto[]; total: number }> {
    return this.service.searchEmoji(query.q, query.groupId, query.page, query.limit);
  }
}
