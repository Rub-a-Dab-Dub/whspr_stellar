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
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessageOwnershipGuard } from './guards/message-ownership.guard';
import { MessageResponseDto } from './dto/message-response.dto';
import { MessageEditHistoryDto } from './dto/message-edit-history.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { MessagesGateway } from './gateways/messages.gateway';

@Controller('messages')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMessage(
    @Body() createMessageDto: CreateMessageDto,
    @Request() req,
  ): Promise<MessageResponseDto> {
    return this.messageService.createMessage(createMessageDto, req.user.id);
  }

  /**
   * POST /rooms/:id/messages - Create message in room with WebSocket broadcast
   */
  @Post('rooms/:roomId/messages')
  @HttpCode(HttpStatus.CREATED)
  async createRoomMessage(
    @Param('roomId') roomId: string,
    @Body() createMessageDto: CreateMessageDto,
    @Request() req,
  ): Promise<MessageResponseDto> {
    // Validate room membership
    if (!this.messagesGateway.isUserInRoom(roomId, req.user.id)) {
      throw new Error('User is not a member of this room');
    }

    // Create message
    const message = await this.messageService.createMessage(
      { ...createMessageDto, roomId },
      req.user.id,
    );

    // Broadcast to room via WebSocket
    this.messagesGateway.broadcastToRoom(roomId, 'message-created', message);

    return message;
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

  /**
   * Get messages for a room
   */
  @Get('rooms/:roomId')
  async getRoomMessages(
    @Param('roomId') roomId: string,
    @Query() query: GetMessagesDto,
  ): Promise<{
    messages: MessageResponseDto[];
    nextCursor: string | null;
  }> {
    return this.messageService.getRoomMessages(roomId, query);
  }

  @Get(':id')
  async getMessageById(
    @Param('id') messageId: string,
  ): Promise<MessageResponseDto> {
    const message = await this.messageService.findByIdOrFail(messageId);
    return {
      id: message.id,
      conversationId: message.conversationId,
      roomId: message.roomId,
      authorId: message.authorId,
      content: message.isDeleted ? '[deleted message]' : message.content,
      type: message.type,
      mediaUrl: message.mediaUrl,
      fileName: message.fileName,
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
    const updatedMessage = await this.messageService.editMessage(
      messageId,
      updateMessageDto,
      req.user.id,
    );

    // Broadcast edit via WebSocket
    const message = await this.messageService.findByIdOrFail(messageId);
    this.messagesGateway.broadcastToRoom(message.roomId, 'message-updated', updatedMessage);

    return updatedMessage;
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

    // Broadcast deletion via WebSocket
    const message = await this.messageService.findByIdOrFail(messageId);
    this.messagesGateway.broadcastToRoom(message.roomId, 'message-deleted', {
      messageId,
      deletedAt: new Date(),
    });

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
    const restoredMessage = await this.messageService.restoreMessage(messageId, req.user.id);

    // Broadcast restoration via WebSocket
    const message = await this.messageService.findByIdOrFail(messageId);
    this.messagesGateway.broadcastToRoom(message.roomId, 'message-restored', restoredMessage);

    return restoredMessage;
  }


  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(
    @Param('id') messageId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Query('storage') storage: 'IPFS' | 'ARWEAVE' = 'IPFS',
  ) {
    if (!file) {
      throw new Error('No file provided');
    }
    return this.messageService.uploadFile(messageId, file, req.user.id, storage);
  }

  @Get('attachments/:id')
  async getAttachment(@Param('id') id: string, @Res() res) {
    const url = await this.messageService.getAttachmentUrl(id);
    return res.redirect(url);
  }
}
