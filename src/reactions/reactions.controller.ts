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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AddReactionDto } from './dto/add-reaction.dto';
import { MessageReactionsResponseDto, ReactionSummaryDto } from './dto/reaction-summary.dto';
import { ReactionsService } from './reactions.service';

@ApiTags('reactions')
@ApiBearerAuth()
@Controller('messages/:id/reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a reaction to a message' })
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiResponse({ status: 201, type: [ReactionSummaryDto] })
  addReaction(
    @Param('id', ParseUUIDPipe) messageId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddReactionDto,
  ): Promise<ReactionSummaryDto[]> {
    return this.reactionsService.addReaction(messageId, userId, dto);
  }

  @Delete(':emoji')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a reaction from a message' })
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiParam({ name: 'emoji', description: 'Emoji reaction to remove' })
  async removeReaction(
    @Param('id', ParseUUIDPipe) messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.reactionsService.removeReaction(messageId, userId, emoji);
  }

  @Get()
  @ApiOperation({ summary: 'Get reaction summary for a message' })
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiResponse({ status: 200, type: MessageReactionsResponseDto })
  getReactions(
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<MessageReactionsResponseDto> {
    return this.reactionsService.getReactions(messageId);
  }
}
