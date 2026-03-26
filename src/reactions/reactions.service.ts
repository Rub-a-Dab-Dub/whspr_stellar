import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import { Message } from '../Conversation Module/src/conversations/entities/message.entity';
import { AddReactionDto } from './dto/add-reaction.dto';
import { MessageReactionsResponseDto, ReactionSummaryDto } from './dto/reaction-summary.dto';
import { ReactionsRepository } from './reactions.repository';

@Injectable()
export class ReactionsService {
  constructor(
    private readonly reactionsRepository: ReactionsRepository,
    private readonly chatGateway: ChatGateway,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
  ) {}

  async addReaction(
    messageId: string,
    userId: string,
    dto: AddReactionDto,
  ): Promise<ReactionSummaryDto[]> {
    const conversationId = await this.getConversationIdOrThrow(messageId);

    const reaction = await this.reactionsRepository.addReaction(messageId, userId, dto.emoji);

    await this.chatGateway.sendReactionAdded(conversationId, {
      messageId,
      conversationId,
      userId,
      emoji: reaction.emoji,
      timestamp: Date.now(),
    });

    return this.getReactionSummary(messageId);
  }

  async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const conversationId = await this.getConversationIdOrThrow(messageId);

    const removed = await this.reactionsRepository.removeReaction(messageId, userId, emoji);
    if (removed === 0) {
      throw new NotFoundException('Reaction not found');
    }

    await this.chatGateway.sendReactionRemoved(conversationId, {
      messageId,
      conversationId,
      userId,
      emoji,
      timestamp: Date.now(),
    });
  }

  async getReactions(messageId: string): Promise<MessageReactionsResponseDto> {
    await this.getConversationIdOrThrow(messageId);
    const summary = await this.getReactionSummary(messageId);
    return { summary };
  }

  async getReactionSummary(messageId: string): Promise<ReactionSummaryDto[]> {
    const groups = await this.reactionsRepository.getReactionSummary(messageId);
    return groups.map((group) => ({
      emoji: group.emoji,
      count: group.count,
      sampleUsers: group.sampleUsers,
    }));
  }

  private async getConversationIdOrThrow(messageId: string): Promise<string> {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
      select: ['id', 'conversationId'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message.conversationId;
  }
}
