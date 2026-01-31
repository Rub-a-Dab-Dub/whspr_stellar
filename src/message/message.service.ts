import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Message } from './entities/message.entity';
import { MessageEditHistory } from './entities/message-edit-history.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { MessageEditHistoryDto } from './dto/message-edit-history.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { ProfanityFilterService } from './services/profanity-filter.service';
import { MessageType } from './enums/message-type.enum';
import { UserStatsService } from '../users/services/user-stats.service';
import { NotificationService } from '../notifications/services/notification.service';
import { Attachment } from './entities/attachment.entity';
import { IpfsStorageService } from '../storage/services/ipfs-storage.service';
import { ArweaveStorageService } from '../storage/services/arweave-storage.service';
import { VirusScanService } from '../storage/services/virus-scan.service';
import { ThumbnailService } from '../storage/services/thumbnail.service';

@Injectable()
export class MessageService {
  private readonly EDIT_TIME_LIMIT_MINUTES = 15;
  private readonly MAX_MESSAGE_LENGTH = 5000;
  private readonly MIN_MESSAGE_LENGTH = 1;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageEditHistory)
    private readonly editHistoryRepository: Repository<MessageEditHistory>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    private readonly profanityFilterService: ProfanityFilterService,
    private readonly userStatsService: UserStatsService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly ipfsService: IpfsStorageService,
    private readonly arweaveService: ArweaveStorageService,
    private readonly virusScanService: VirusScanService,
    private readonly thumbnailService: ThumbnailService,
  ) {}

  /**
   * Validate message content
   */
  private validateMessageContent(content: string): void {
    if (!content || content.trim().length < this.MIN_MESSAGE_LENGTH) {
      throw new BadRequestException('Message content cannot be empty');
    }

    if (content.length > this.MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Message content cannot exceed ${this.MAX_MESSAGE_LENGTH} characters`,
      );
    }
  }

  /**
   * Create a new message
   */
  async createMessage(
    createMessageDto: CreateMessageDto,
    userId: string,
  ): Promise<MessageResponseDto> {
    // Validate content
    this.validateMessageContent(createMessageDto.content);

    // Check for profanity
    if (this.profanityFilterService.containsProfanity(createMessageDto.content)) {
      throw new BadRequestException('Message contains inappropriate content');
    }

    const message = this.messageRepository.create({
      conversationId: createMessageDto.conversationId,
      roomId: createMessageDto.roomId,
      authorId: userId,
      content: createMessageDto.content,
      type: createMessageDto.type || MessageType.TEXT,
      mediaUrl: createMessageDto.mediaUrl || null,
      fileName: createMessageDto.fileName || null,
      originalContent: null,
      isEdited: false,
    });

    const savedMessage = await this.messageRepository.save(message);

    await this.userStatsService.recordMessageSent(userId, {
      isTip: savedMessage.type === MessageType.TIP,
      tipRecipientId: createMessageDto.tipRecipientId,
      tipAmount: createMessageDto.tipAmount,
    });
    // Create notifications for mentions and room members
    try {
      await this.notificationService.createMessageNotification(
        savedMessage.id,
        userId,
        savedMessage.content,
        savedMessage.roomId,
        savedMessage.conversationId,
      );
    } catch (error) {
      // Log error but don't fail message creation
      console.error('Failed to create message notifications:', error);
    }

    return this.toResponseDto(savedMessage);
  }

  async findById(messageId: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['editHistory', 'author', 'reactions'],
    });
  }

  async findByIdOrFail(messageId: string): Promise<Message> {
    const message = await this.findById(messageId);
    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }
    return message;
  }

  async getConversationMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ messages: MessageResponseDto[]; total: number; page: number }> {
    const skip = (page - 1) * limit;
    const [messages, total] = await this.messageRepository.findAndCount({
      where: {
        conversationId,
        isDeleted: false,
      },
      relations: ['author', 'editHistory', 'reactions'],
      order: { createdAt: 'ASC' },
      skip,
      take: limit,
    });

    return {
      messages: messages.map((msg) => this.toResponseDto(msg)),
      total,
      page,
    };
  }

  /**
   * Get messages for a room with cursor-based pagination
   */
  async getRoomMessages(
    roomId: string,
    query: GetMessagesDto,
  ): Promise<{
    messages: MessageResponseDto[];
    nextCursor: string | null;
  }> {
    const { limit = 50, cursor, search, type, from, to, parentId } = query;
    const cacheKey = `room_messages:${roomId}:first_page`;

    // Try cache for first page with no filters
    if (!cursor && !search && !type && !from && !to && !parentId) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }
    }

    const queryBuilder = this.messageRepository.createQueryBuilder('message');

    queryBuilder
      .leftJoinAndSelect('message.author', 'author')
      .leftJoinAndSelect('message.editHistory', 'editHistory')
      .leftJoinAndSelect('message.reactions', 'reactions')
      .where('message.roomId = :roomId', { roomId })
      .andWhere('message.isDeleted = :isDeleted', { isDeleted: false });

    if (parentId) {
      queryBuilder.andWhere('message.parentId = :parentId', { parentId });
    } else {
      // By default, only show top-level messages unless searching
      if (!search) {
        queryBuilder.andWhere('message.parentId IS NULL');
      }
    }

    if (search) {
      queryBuilder.andWhere('message.content ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (type) {
      queryBuilder.andWhere('message.type = :type', { type });
    }

    if (from) {
      queryBuilder.andWhere('message.createdAt >= :from', { from });
    }

    if (to) {
      queryBuilder.andWhere('message.createdAt <= :to', { to });
    }

    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('message.createdAt < :date', {
            date: decoded.createdAt,
          }).orWhere(
            'message.createdAt = :date AND message.id < :id',
            { date: decoded.createdAt, id: decoded.id },
          );
        }),
      );
    }

    queryBuilder
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(limit + 1);

    const messages = await queryBuilder.getMany();
    let nextCursor = null;

    if (messages.length > limit) {
      const nextItem = messages.pop();
      nextCursor = this.encodeCursor(nextItem!);
    }

    const result = {
      messages: messages.map((msg) => this.toResponseDto(msg)),
      nextCursor,
    };

    // Cache first page result
    if (!cursor && !search && !type && !from && !to && !parentId) {
      await this.cacheManager.set(cacheKey, result, 300000); // 5 minutes
    }

    return result;
  }

  private encodeCursor(message: Message): string {
    const payload = `${message.createdAt.getTime()}_${message.id}`;
    return Buffer.from(payload).toString('base64');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    const payload = Buffer.from(cursor, 'base64').toString('utf-8');
    const [timestamp, id] = payload.split('_');
    return {
      createdAt: new Date(parseInt(timestamp, 10)),
      id,
    };
  }

  private async invalidateRoomCache(roomId: string): Promise<void> {
    await this.cacheManager.del(`room_messages:${roomId}:first_page`);
  }

  async editMessage(
    messageId: string,
    updateMessageDto: UpdateMessageDto,
    userId: string,
  ): Promise<MessageResponseDto> {
    // Validate content
    this.validateMessageContent(updateMessageDto.content);

    // Check for profanity
    if (this.profanityFilterService.containsProfanity(updateMessageDto.content)) {
      throw new BadRequestException('Message contains inappropriate content');
    }

    const message = await this.findByIdOrFail(messageId);

    // Check ownership
    if (message.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    // Check if message is deleted
    if (message.isDeleted) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    // Check edit time limit
    const createdTime = new Date(message.createdAt);
    const nowTime = new Date();
    const diffMinutes =
      (nowTime.getTime() - createdTime.getTime()) / (1000 * 60);

    if (diffMinutes > this.EDIT_TIME_LIMIT_MINUTES) {
      throw new ForbiddenException(
        `Messages can only be edited within ${this.EDIT_TIME_LIMIT_MINUTES} minutes of creation`,
      );
    }

    // Store original content on first edit
    if (!message.isEdited && !message.originalContent) {
      message.originalContent = message.content;
    }

    // Create edit history entry
    await this.editHistoryRepository.save({
      messageId,
      previousContent: message.content,
      newContent: updateMessageDto.content,
      editedAt: new Date(),
    });

    // Update message
    message.content = updateMessageDto.content;
    message.isEdited = true;
    message.editedAt = new Date();

    const updatedMessage = await this.messageRepository.save(message);

    // Invalidate cache
    await this.invalidateRoomCache(message.roomId);

    return this.toResponseDto(updatedMessage);
  }

  async getEditHistory(messageId: string): Promise<MessageEditHistoryDto[]> {
    const message = await this.findByIdOrFail(messageId);

    const history = await this.editHistoryRepository.find({
      where: { messageId },
      order: { editedAt: 'ASC' },
    });

    return history.map((h) => this.editHistoryToDto(h));
  }

  async softDeleteMessage(
    messageId: string,
    userId: string,
  ): Promise<MessageResponseDto> {
    const message = await this.findByIdOrFail(messageId);

    // Check ownership
    if (message.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Message is already deleted');
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;

    const deletedMessage = await this.messageRepository.save(message);

    // Invalidate cache
    await this.invalidateRoomCache(message.roomId);

    return this.toResponseDto(deletedMessage, true);
  }

  async hardDeleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.findByIdOrFail(messageId);

    // Delete associated edit history (cascade should handle this)
    await this.editHistoryRepository.delete({ messageId });

    // Hard delete the message
    message.isHardDeleted = true;
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;

    await this.messageRepository.save(message);
    await this.messageRepository.delete(messageId);

    // Invalidate cache
    await this.invalidateRoomCache(message.roomId);
  }

  async cascadeDeleteReactions(messageId: string): Promise<void> {
    // This would be implemented based on your reactions structure
    // For now, it's a placeholder for future implementation
  }

  async cascadeDeleteReplies(messageId: string): Promise<void> {
    // This would delete replies to this message
    // For now, soft delete all replies
    await this.messageRepository.update(
      { conversationId: messageId },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );
  }

  async restoreMessage(
    messageId: string,
    userId: string,
  ): Promise<MessageResponseDto> {
    const message = await this.findByIdOrFail(messageId);

    // Check ownership
    if (message.authorId !== userId) {
      throw new ForbiddenException('You can only restore your own messages');
    }

    if (!message.isDeleted) {
      throw new BadRequestException('Message is not deleted');
    }

    message.isDeleted = false;
    message.deletedAt = null;
    message.deletedBy = null;

    const restoredMessage = await this.messageRepository.save(message);

    // Invalidate cache
    await this.invalidateRoomCache(message.roomId);

    return this.toResponseDto(restoredMessage);
  }

  private toResponseDto(
    message: Message,
    includeHistory: boolean = false,
  ): MessageResponseDto {
    const dto: MessageResponseDto = {
      id: message.id,
      conversationId: message.conversationId,
      roomId: message.roomId,
      authorId: message.authorId,
      author: message.author
        ? {
            id: message.author.id,
            email: message.author.email,
          }
        : undefined,
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
      reactionsCount: message.reactions ? message.reactions.length : 0,
    };

    if (includeHistory && message.editHistory) {
      dto.editHistory = message.editHistory.map((h) =>
        this.editHistoryToDto(h),
      );
    }

    return dto;
  }

  private editHistoryToDto(history: MessageEditHistory): MessageEditHistoryDto {
    return {
      id: history.id,
      messageId: history.messageId,
      previousContent: history.previousContent,
      newContent: history.newContent,
      editedAt: history.editedAt,
    };
    }

  async uploadFile(
    messageId: string,
    file: Express.Multer.File,
    userId: string,
    storage: 'IPFS' | 'ARWEAVE' = 'IPFS',
  ): Promise<Attachment> {
    const message = await this.findByIdOrFail(messageId);

    if (message.authorId !== userId) {
      throw new ForbiddenException('You can only attach files to your own messages');
    }

    // 1. Virus Scan
    const isClean = await this.virusScanService.scanBuffer(file.buffer);
    if (!isClean) {
      throw new BadRequestException('File is infected with malware');
    }

    // 2. Generate Thumbnail (if image)
    let thumbnailUrl: string | undefined;
    if (file.mimetype.startsWith('image/')) {
        try {
            const thumbBuffer = await this.thumbnailService.generateThumbnail(file.buffer, file.mimetype);
            // Upload thumbnail to IPFS always for speed? Or same provider?
            // Let's stick effectively to same provider logic or just IPFS for thumbnails usually.
            // For simplicity, we upload thumbnail to IPFS.
            const thumbUpload = await this.ipfsService.upload(thumbBuffer);
            thumbnailUrl = this.ipfsService.getGatewayUrl(thumbUpload.path);
        } catch (e) {
            console.error('Thumbnail generation failed', e);
        }
    }

    // 3. Upload File
    let storageHash: string;
    let url: string;

    if (storage === 'ARWEAVE') {
        const result = await this.arweaveService.upload(file.buffer, file.mimetype);
        storageHash = result.id;
        url = this.arweaveService.getGatewayUrl(result.id);
    } else {
        const result = await this.ipfsService.upload(file.buffer);
        storageHash = result.path;
        url = this.ipfsService.getGatewayUrl(result.path);
    }

    // 4. Create Attachment
    const attachment = this.attachmentRepository.create({
      message,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageProvider: storage,
      storageHash,
      url,
      thumbnailUrl,
      isScanned: true,
    });

    return this.attachmentRepository.save(attachment);
  }

  async getAttachmentUrl(attachmentId: string): Promise<string> {
    const attachment = await this.attachmentRepository.findOne({ where: { id: attachmentId } });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return attachment.url;
  }
}
