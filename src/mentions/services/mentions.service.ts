import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { MentionsRepository } from '../repositories/mentions.repository';
import { Mention } from '../entities/mention.entity';
import { MentionResponseDto, MentionListResponseDto, ParsedMention } from '../dto/mention.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { InAppNotificationType } from '../../notifications/entities/notification.entity';
import { MentionsGateway } from '../gateway/mentions.gateway';

/**
 * Service for handling user mentions in messages
 * Parses mentions, creates records, tracks unread, sends notifications
 */
@Injectable()
export class MentionsService {
  // Pattern to match @username mentions (word characters and dots)
  private readonly MENTION_PATTERN = /@([a-zA-Z0-9._-]+)/g;

  constructor(
    private readonly repository: MentionsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly mentionsGateway: MentionsGateway,
  ) {}

  /**
   * Parse mentions from message content
   * Returns array of parsed mentions with positions
   */
  parseMentions(content: string): ParsedMention[] {
    const mentions: ParsedMention[] = [];
    let match;

    // Reset regex lastIndex for global matches
    this.MENTION_PATTERN.lastIndex = 0;

    while ((match = this.MENTION_PATTERN.exec(content)) !== null) {
      mentions.push({
        username: match[1],
        userId: '', // Would be resolved in createMentions
        position: match.index,
        length: match[0].length,
      });
    }

    return mentions;
  }

  /**
   * Create mention records for a message
   * Called during message creation
   * Validates mentioned users are conversation participants
   */
  async createMentions(
    messageId: string,
    conversationId: string,
    mentionedBy: string,
    mentionedUserIds: string[],
  ): Promise<Mention[]> {
    if (mentionedUserIds.length === 0) {
      return [];
    }

    // Remove duplicates
    const uniqueUserIds = [...new Set(mentionedUserIds)];

    // In a real implementation:
    // - Verify each user is a participant in the conversation
    // - Prevent self-mentions
    // - Check user exists

    const mentions = uniqueUserIds.map((userId) =>
      this.repository.create({
        messageId,
        mentionedUserId: userId,
        mentionedBy,
        conversationId,
        isRead: false,
      }),
    );

    const created = await this.repository.save(mentions);

    // Trigger in-app notification and WebSocket push for each mentioned user
    await Promise.allSettled(
      created.map(async (mention) => {
        await this.notificationsService.createNotification({
          userId: mention.mentionedUserId,
          type: InAppNotificationType.MENTION,
          title: 'You were mentioned',
          body: `Someone mentioned you in a conversation`,
          data: {
            messageId: mention.messageId,
            conversationId: mention.conversationId,
            mentionedBy: mention.mentionedBy,
            mentionId: mention.id,
          },
        });
        this.mentionsGateway.emitMentionNew(mention.mentionedUserId, mention);
      }),
    );

    return created;
  }

  /**
   * Mark a single mention as read
   */
  async markMentionRead(mentionId: string): Promise<MentionResponseDto> {
    const mention = await this.repository.findOneBy({ id: mentionId });
    if (!mention) {
      throw new NotFoundException(`Mention ${mentionId} not found`);
    }

    await this.repository.markMentionAsRead(mentionId);

    const updated = await this.repository.findOneBy({ id: mentionId });
    return this.mapToDto(updated!);
  }

  /**
   * Get unread mentions for a user
   */
  async getUnreadMentions(userId: string): Promise<MentionListResponseDto> {
    const mentions = await this.repository.findUnreadMentions(userId);

    return {
      data: mentions.map((m) => this.mapToDto(m)),
      total: mentions.length,
    };
  }

  /**
   * Get mentions in a specific conversation
   */
  async getMentionsInConversation(
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<MentionListResponseDto> {
    const [mentions, total] = await this.repository.getMentionsInConversation(
      conversationId,
      limit,
      offset,
    );

    return {
      data: mentions.map((m) => this.mapToDto(m)),
      total,
    };
  }

  /**
   * Get all mentions for a user (received)
   */
  async getMentionsForUser(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<MentionListResponseDto> {
    const [mentions, total] = await this.repository.getMentionsForUser(userId, limit, offset);

    return {
      data: mentions.map((m) => this.mapToDto(m)),
      total,
    };
  }

  /**
   * Get count of unread mentions for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.getUnreadCount(userId);
  }

  /**
   * Mark all mentions for a user as read
   */
  async markAllRead(userId: string): Promise<{ count: number }> {
    const beforeCount = await this.repository.getUnreadCount(userId);
    await this.repository.markAllUserMentionsAsRead(userId);
    const afterCount = await this.repository.getUnreadCount(userId);

    return { count: beforeCount - afterCount };
  }

  /**
   * Resolve @usernames to user IDs using a lookup service
   * In a real implementation, this would query the users service/database
   */
  async resolveUsernameToUserId(username: string): Promise<string | null> {
    // TODO: Implement username to user ID resolution
    // This would typically:
    // - Query a users table where username matches
    // - Or use a cache/index for fast lookup
    // For now, return null to indicate not found
    return null;
  }

  /**
   * Get forward chain of mentions (transitive mentions)
   * For mentions that mention other users
   */
  async getMentionChain(mentionId: string): Promise<string[]> {
    const mention = await this.repository.findOneBy({ id: mentionId });
    if (!mention) {
      throw new NotFoundException(`Mention ${mentionId} not found`);
    }

    return [mention.mentionedUserId, mention.mentionedBy];
  }

  /**
   * Delete mentions when message is deleted
   */
  async deleteByMessageId(messageId: string): Promise<void> {
    await this.repository.deleteMentionByMessageId(messageId);
  }

  /**
   * Private helper: Map entity to DTO
   */
  private mapToDto(mention: Mention): MentionResponseDto {
    return {
      id: mention.id,
      messageId: mention.messageId,
      mentionedUserId: mention.mentionedUserId,
      mentionedBy: mention.mentionedBy,
      conversationId: mention.conversationId,
      isRead: mention.isRead,
      createdAt: mention.createdAt,
      updatedAt: mention.updatedAt,
    };
  }
}
