import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Headers,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { ConversationsService } from '../services/conversations.service';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { ConversationType } from '../entities/conversation.entity';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  async createConversation(
    @Body() dto: CreateConversationDto,
    @Headers('x-user-id') userId: string,
  ) {
    if (dto.type === ConversationType.DIRECT) {
      return this.conversationsService.createDirect(dto, userId);
    } else {
      return this.conversationsService.createGroup(dto, userId);
    }
  }

  @Get()
  async getConversations(
    @Headers('x-user-id') userId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
    @Query('includeArchived', new DefaultValuePipe(false), ParseBoolPipe) includeArchived?: boolean,
  ) {
    return this.conversationsService.getConversations(userId, limit, cursor, includeArchived);
  }

  @Get(':id')
  async getConversation(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.conversationsService.getConversation(id, userId);
  }

  @Patch(':id/archive')
  async archiveConversation(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body('isArchived', ParseBoolPipe) isArchived: boolean,
  ) {
    return this.conversationsService.archiveConversation(id, userId, isArchived);
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.conversationsService.markRead(id, userId);
  }

  @Post(':id/mute')
  async muteConversation(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body('isMuted', ParseBoolPipe) isMuted: boolean,
  ) {
    return this.conversationsService.muteConversation(id, userId, isMuted);
  }
}
