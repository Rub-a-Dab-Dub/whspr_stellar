import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessageOwnershipGuard } from './guards/message-ownership.guard';
import { MessageResponseDto } from './dto/message-response.dto';
import { MessageEditHistoryDto } from './dto/message-edit-history.dto';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMessage(
    @Body() createMessageDto: CreateMessageDto,
    @Request() req,
  ): Promise<MessageResponseDto> {
    return this.messageService.createMessage(createMessageDto, req.user.id);
  }

  @Get('conversation/:conversationId')
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ): Promise<{
    messages: MessageResponseDto[];
    total: number;
    page: number;
  }> {
    return this.messageService.getConversationMessages(
      conversationId,
      page,
      limit,
    );
  }

  @Get(':id')
  async getMessageById(
    @Param('id') messageId: string,
  ): Promise<MessageResponseDto> {
    const message = await this.messageService.findByIdOrFail(messageId);
    return {
      id: message.id,
      conversationId: message.conversationId,
      authorId: message.authorId,
      content: message.isDeleted ? '[deleted message]' : message.content,
      originalContent: message.originalContent,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      isDeleted: message.isDeleted,
      deletedAt: message.deletedAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  @Get(':id/edit-history')
  async getEditHistory(
    @Param('id') messageId: string,
  ): Promise<MessageEditHistoryDto[]> {
    return this.messageService.getEditHistory(messageId);
  }

  @Patch(':id')
  @UseGuards(MessageOwnershipGuard)
  async editMessage(
    @Param('id') messageId: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Request() req,
  ): Promise<MessageResponseDto> {
    return this.messageService.editMessage(
      messageId,
      updateMessageDto,
      req.user.id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(MessageOwnershipGuard)
  async softDeleteMessage(
    @Param('id') messageId: string,
    @Request() req,
  ): Promise<{ message: string; deletedMessage: MessageResponseDto }> {
    const deletedMessage = await this.messageService.softDeleteMessage(
      messageId,
      req.user.id,
    );
    return {
      message: 'Message deleted successfully',
      deletedMessage,
    };
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.OK)
  async hardDeleteMessage(
    @Param('id') messageId: string,
    @Request() req,
  ): Promise<{ message: string }> {
    // In a real scenario, you'd check if user is admin
    await this.messageService.hardDeleteMessage(messageId, req.user.id);
    return {
      message: 'Message permanently deleted',
    };
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(MessageOwnershipGuard)
  async restoreMessage(
    @Param('id') messageId: string,
    @Request() req,
  ): Promise<MessageResponseDto> {
    return this.messageService.restoreMessage(messageId, req.user.id);
  }
}
