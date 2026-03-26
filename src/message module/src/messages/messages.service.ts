import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentType, Message } from './message.entity';
import { MessagesRepository } from './messages.repository';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { PaginatedResult, PaginationQuery } from './pagination';
import { MessagesGateway } from './messages.gateway';
import { SorobanService } from './soroban.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly repository: MessagesRepository,
    private readonly gateway: MessagesGateway,
    private readonly soroban: SorobanService,
  ) {}

  async sendMessage(conversationId: string, senderId: string, dto: SendMessageDto): Promise<Message> {
    const sentAt = new Date();
    const encrypted = this.encrypt(dto.content);
    const message = await this.repository.create({
      conversationId,
      senderId,
      content: encrypted,
      contentType: dto.contentType,
      replyToId: dto.replyToId ?? null,
      sentAt,
    });

    // Emit WebSocket event
    this.gateway.emitNewMessage(message);

    // Submit hash asynchronously (fire and forget, but logged)
    void this.soroban.submitMessageHash(message.id, dto.content).catch((err) =>
      // eslint-disable-next-line no-console
      console.error('Soroban submission failed', err),
    );

    return message;
  }

  async editMessage(id: string, dto: EditMessageDto): Promise<Message> {
    const message = await this.repository.findById(id);
    if (!message) throw new NotFoundException('Message not found');
    if (message.isDeleted) throw new BadRequestException('Cannot edit a deleted message');

    message.content = this.encrypt(dto.content);
    message.isEdited = true;
    message.editedAt = new Date();
    await this.repository.save(message);
    return message;
  }

  async deleteMessage(id: string): Promise<Message> {
    const message = await this.repository.findById(id);
    if (!message) throw new NotFoundException('Message not found');
    message.content = null;
    message.isDeleted = true;
    await this.repository.save(message);
    return message;
  }

  async getMessages(conversationId: string, pagination: PaginationQuery): Promise<PaginatedResult<Message>> {
    return this.repository.findByConversation(conversationId, pagination);
  }

  async getMessageById(id: string): Promise<Message> {
    const message = await this.repository.findById(id);
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async markDelivered(id: string): Promise<Message> {
    const message = await this.repository.findById(id);
    if (!message) throw new NotFoundException('Message not found');
    message.deliveredAt = message.deliveredAt ?? new Date();
    await this.repository.save(message);
    return message;
  }

  async markRead(id: string): Promise<Message> {
    const message = await this.repository.findById(id);
    if (!message) throw new NotFoundException('Message not found');
    message.readAt = new Date();
    await this.repository.save(message);
    return message;
  }

  private encrypt(plain: string): string {
    return Buffer.from(plain, 'utf8').toString('base64');
  }
}
