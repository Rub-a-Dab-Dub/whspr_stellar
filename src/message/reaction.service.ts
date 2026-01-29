import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MessageReaction } from './entities/message-reaction.entity';
import { ReactionRepository } from './repositories/reaction.repository';
import { MessageService } from './message.service';
import { RedisService } from '../redis/redis.service';
import { CacheService } from '../cache/cache.service';
import {
  ReactionResponseDto,
  ReactionCountDto,
  MessageReactionsAggregateDto,
} from './dto/reaction.dto';
import { isValidReactionType } from './constants/reaction-types.constant';
import { NotificationService } from '../notifications/services/notification.service';

@Injectable()
export class ReactionService {
  private readonly logger = new Logger(ReactionService.name);
  private readonly REACTION_CACHE_TTL = 3600; // 1 hour
  private readonly REACTION_COUNT_CACHE_PREFIX = 'reaction:count:';
  private readonly POPULAR_REACTIONS_CACHE_KEY = 'reactions:popular';
  private readonly USER_REACTIONS_CACHE_PREFIX = 'user:reactions:';

  constructor(
    @InjectRepository(MessageReaction)
    private readonly reactionRepository: ReactionRepository,
    private readonly messageService: MessageService,
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Add a reaction to a message
   */
  async addReaction(
    messageId: string,
    userId: string,
    type: string,
  ): Promise<ReactionResponseDto> {
    // Validate message exists
    const message = await this.messageService.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Validate reaction type (allow custom emojis/reactions)
    if (!type || typeof type !== 'string' || type.trim().length === 0) {
      throw new BadRequestException('Invalid reaction type');
    }

    const trimmedType = type.trim();

    // Check if user already has this exact reaction
    const existingReaction = await this.reactionRepository.findUserReaction(
      messageId,
      userId,
      trimmedType,
    );

    if (existingReaction) {
      throw new ConflictException(
        'User already has this reaction on the message',
      );
    }

    try {
      const isCustom = !isValidReactionType(trimmedType);
      const reaction = await this.reactionRepository.addReaction(
        messageId,
        userId,
        trimmedType,
        isCustom,
      );

      // Create notification for message author
      try {
        await this.notificationService.createReactionNotification(
          messageId,
          message.authorId,
          userId,
          trimmedType,
          'added',
        );
      } catch (error) {
        // Log error but don't fail reaction creation
        this.logger.error('Failed to create reaction notification:', error);
      }

      // Invalidate caches
      await this.invalidateReactionCaches(messageId, userId);

      this.logger.debug(
        `Reaction added: ${trimmedType} to message ${messageId} by user ${userId}`,
      );

      return this.toResponseDto(reaction);
    } catch (error) {
      this.logger.error('Error adding reaction:', error);
      throw error;
    }
  }

  /**
   * Remove a specific reaction
   */
  async removeReaction(
    messageId: string,
    userId: string,
    type: string,
  ): Promise<void> {
    // Validate message exists
    const message = await this.messageService.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const trimmedType = type.trim();

    const removed = await this.reactionRepository.removeReaction(
      messageId,
      userId,
      trimmedType,
    );

    if (!removed) {
      throw new NotFoundException('Reaction not found');
    }

    // Create notification for message author
    try {
      await this.notificationService.createReactionNotification(
        messageId,
        message.authorId,
        userId,
        trimmedType,
        'removed',
      );
    } catch (error) {
      // Log error but don't fail reaction removal
      this.logger.error('Failed to create reaction removal notification:', error);
    }

    // Invalidate caches
    await this.invalidateReactionCaches(messageId, userId);

    this.logger.debug(
      `Reaction removed: ${trimmedType} from message ${messageId} by user ${userId}`,
    );
  }

  /**
   * Get aggregated reactions for a message
   */
  async getMessageReactions(
    messageId: string,
    userId?: string,
  ): Promise<MessageReactionsAggregateDto> {
    // Validate message exists
    const message = await this.messageService.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Try to get from cache
    const cacheKey = `${this.REACTION_COUNT_CACHE_PREFIX}${messageId}`;
    const cached =
      await this.cacheService.get<MessageReactionsAggregateDto>(cacheKey);

    if (cached) {
      // If user specified, add their reactions
      if (userId) {
        const userReactions =
          await this.reactionRepository.getUserMessageReactions(
            messageId,
            userId,
          );
        cached.userReactions = userReactions;
      }
      return cached;
    }

    // Get reactions from database
    const reactions =
      await this.reactionRepository.getReactionCounts(messageId);
    let userReactions: string[] = [];

    if (userId) {
      userReactions = await this.reactionRepository.getUserMessageReactions(
        messageId,
        userId,
      );
    }

    const aggregate: MessageReactionsAggregateDto = {
      messageId,
      reactions: reactions.map((r) => ({
        ...r,
        userReacted: userId ? userReactions.includes(r.type) : undefined,
      })),
      totalReactions: reactions.reduce((sum, r) => sum + r.count, 0),
      userReactions,
    };

    // Cache the result
    await this.cacheService.set(cacheKey, aggregate, this.REACTION_CACHE_TTL);

    return aggregate;
  }

  /**
   * Get all reactions for a message with user details
   */
  async getMessageReactionsDetailed(
    messageId: string,
  ): Promise<MessageReaction[]> {
    const message = await this.messageService.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.reactionRepository.findMessageReactions(messageId);
  }

  /**
   * Get reactions by type for a message
   */
  async getReactionsByType(messageId: string, type: string): Promise<string[]> {
    const reactions = await this.reactionRepository.findReactionsByType(
      messageId,
      type,
    );
    const filtered = reactions
      .map((r) => r.user?.id)
      .filter((id) => id !== undefined);
    return filtered as string[];
  }

  /**
   * Get user's reactions for a message
   */
  async getUserReactions(messageId: string, userId: string): Promise<string[]> {
    const message = await this.messageService.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.reactionRepository.getUserMessageReactions(messageId, userId);
  }

  /**
   * Get most popular reactions globally
   */
  async getPopularReactions(limit: number = 10): Promise<ReactionCountDto[]> {
    // Try to get from cache
    const cached = await this.cacheService.get<ReactionCountDto[]>(
      this.POPULAR_REACTIONS_CACHE_KEY,
    );

    if (cached) {
      return cached.slice(0, limit);
    }

    // Get from database
    const popular = await this.reactionRepository.getPopularReactions(limit);

    // Cache for longer period
    await this.cacheService.set(
      this.POPULAR_REACTIONS_CACHE_KEY,
      popular,
      86400, // 24 hours
    );

    return popular;
  }

  /**
   * Get aggregated reactions for multiple messages
   */
  async getMultipleMessageReactions(
    messageIds: string[],
    userId?: string,
  ): Promise<Map<string, MessageReactionsAggregateDto>> {
    const result = new Map<string, MessageReactionsAggregateDto>();

    // Try to batch get from cache
    const cachePromises = messageIds.map((id) =>
      this.cacheService.get<MessageReactionsAggregateDto>(
        `${this.REACTION_COUNT_CACHE_PREFIX}${id}`,
      ),
    );

    const cachedResults = await Promise.all(cachePromises);
    const uncachedIds: string[] = [];

    messageIds.forEach((id, index) => {
      const cached = cachedResults[index];
      if (cached) {
        result.set(id, cached);
      } else {
        uncachedIds.push(id);
      }
    });

    // Get uncached from database
    if (uncachedIds.length > 0) {
      const dbResults =
        await this.reactionRepository.getReactionsCountForMessages(uncachedIds);

      for (const [messageId, reactions] of dbResults) {
        const aggregate: MessageReactionsAggregateDto = {
          messageId,
          reactions,
          totalReactions: reactions.reduce((sum, r) => sum + r.count, 0),
          userReactions: [],
        };

        // Cache it
        await this.cacheService.set(
          `${this.REACTION_COUNT_CACHE_PREFIX}${messageId}`,
          aggregate,
          this.REACTION_CACHE_TTL,
        );

        result.set(messageId, aggregate);
      }
    }

    // Add user reactions if specified
    if (userId) {
      for (const [messageId, aggregate] of result) {
        const userReactions =
          await this.reactionRepository.getUserMessageReactions(
            messageId,
            userId,
          );
        aggregate.userReactions = userReactions;
      }
    }

    return result;
  }

  /**
   * Get user's reaction analytics
   */
  async getUserReactionAnalytics(userId: string): Promise<{
    totalReactions: number;
    reactionsByType: ReactionCountDto[];
    recentReactions: ReactionResponseDto[];
  }> {
    const cacheKey = `${this.USER_REACTIONS_CACHE_PREFIX}${userId}:analytics`;
    const cached = await this.cacheService.get<{
      totalReactions: number;
      reactionsByType: ReactionCountDto[];
    }>(cacheKey);

    if (cached) {
      return {
        ...cached,
        recentReactions: [],
      };
    }

    const reactions = await this.reactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const reactionsByType = reactions.reduce((acc, reaction) => {
      const existing = acc.find((r) => r.type === reaction.type);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ type: reaction.type, count: 1 });
      }
      return acc;
    }, [] as ReactionCountDto[]);

    const analytics = {
      totalReactions: reactions.length,
      reactionsByType: reactionsByType.sort((a, b) => b.count - a.count),
      recentReactions: reactions.map((r) => this.toResponseDto(r)),
    };

    // Cache for shorter period since this is user-specific
    await this.cacheService.set(cacheKey, analytics, 1800); // 30 minutes

    return analytics;
  }

  /**
   * Get reaction count for a message
   */
  async getReactionCount(messageId: string): Promise<number> {
    const aggregate = await this.getMessageReactions(messageId);
    return aggregate.totalReactions;
  }

  /**
   * Check if user has specific reaction on message
   */
  async userHasReaction(
    messageId: string,
    userId: string,
    type: string,
  ): Promise<boolean> {
    const reaction = await this.reactionRepository.findUserReaction(
      messageId,
      userId,
      type,
    );
    return !!reaction;
  }

  /**
   * Broadcast reaction event via Redis (for real-time updates)
   */
  async broadcastReactionUpdate(
    messageId: string,
    action: 'added' | 'removed',
    userId: string,
    type: string,
  ): Promise<void> {
    const channel = `messages:${messageId}:reactions`;
    const payload = {
      action,
      userId,
      type,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.redisService.set(
        `${channel}:last-update`,
        JSON.stringify(payload),
        60, // Keep for 60 seconds
      );

      this.logger.debug(
        `Reaction update broadcasted: ${action} on message ${messageId}`,
      );
    } catch (error) {
      this.logger.error('Error broadcasting reaction update:', error);
      // Don't throw - real-time updates are not critical
    }
  }

  /**
   * Helper method to convert entity to DTO
   */
  private toResponseDto(reaction: MessageReaction): ReactionResponseDto {
    return {
      id: reaction.id,
      messageId: reaction.messageId,
      userId: reaction.userId,
      type: reaction.type,
      isCustom: reaction.isCustom,
      createdAt: reaction.createdAt,
      updatedAt: reaction.updatedAt,
    };
  }

  /**
   * Invalidate relevant caches
   */
  private async invalidateReactionCaches(
    messageId: string,
    userId: string,
  ): Promise<void> {
    // Invalidate message reaction count cache
    await this.cacheService.delete(
      `${this.REACTION_COUNT_CACHE_PREFIX}${messageId}`,
    );

    // Invalidate user analytics cache
    await this.cacheService.delete(
      `${this.USER_REACTIONS_CACHE_PREFIX}${userId}:analytics`,
    );

    // Invalidate popular reactions cache
    await this.cacheService.delete(this.POPULAR_REACTIONS_CACHE_KEY);
  }
}
