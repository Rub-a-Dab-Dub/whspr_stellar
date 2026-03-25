import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Body,
  Post,
  Query,
  Headers,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { PaginatedResult } from './pagination';

@Controller()
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Post('conversations/:id/messages')
  async sendMessage(
    @Param('id') conversationId: string,
    @Headers('x-user-id') senderId: string | undefined,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    if (!senderId) {
      throw new BadRequestException('x-user-id header is required to identify sender');
    }
    const message = await this.service.sendMessage(conversationId, senderId, dto);
    return MessageResponseDto.fromEntity(message);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Query('limit') limit = '20',
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResult<MessageResponseDto>> {
    const numericLimit = Number(limit);
    const result = await this.service.getMessages(conversationId, {
      limit: Number.isNaN(numericLimit) ? 20 : numericLimit,
      cursor,
    });
    return {
      data: result.data.map(MessageResponseDto.fromEntity),
      nextCursor: result.nextCursor ?? null,
    };
  }

  @Patch('messages/:id')
  async editMessage(@Param('id') id: string, @Body() dto: EditMessageDto): Promise<MessageResponseDto> {
    const message = await this.service.editMessage(id, dto);
    return MessageResponseDto.fromEntity(message);
  }

  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string): Promise<MessageResponseDto> {
    const message = await this.service.deleteMessage(id);
    return MessageResponseDto.fromEntity(message);
  }
}
