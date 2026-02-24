import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { MessageReaction } from '../entities/message-reaction.entity';
import { ReactionCountDto } from '../dto/reaction.dto';

@Injectable()
export class ReactionRepository extends Repository<MessageReaction> {
  constructor(private dataSource: DataSource) {
    super(MessageReaction, dataSource.createEntityManager());
  }

  /**
   * Get all reactions for a specific message
   */
  async findMessageReactions(messageId: string): Promise<MessageReaction[]> {
    return this.find({
      where: { messageId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific user's reaction on a message
   */
  async findUserReaction(
    messageId: string,
    userId: string,
    type: string,
  ): Promise<MessageReaction | null> {
    return this.findOne({
      where: { messageId, userId, type },
    });
  }

  /**
   * Get all reactions of a specific type for a message
   */
  async findReactionsByType(
    messageId: string,
    type: string,
  ): Promise<MessageReaction[]> {
    return this.find({
      where: { messageId, type },
      relations: ['user'],
    });
  }

  /**
   * Get aggregated reaction counts for a message
   */
  async getReactionCounts(messageId: string): Promise<ReactionCountDto[]> {
    const reactions = await this.find({
      where: { messageId },
      select: ['type'],
    });

    const counts = reactions.reduce((acc, reaction) => {
      const existing = acc.find((r) => r.type === reaction.type);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ type: reaction.type, count: 1 });
      }
      return acc;
    }, [] as ReactionCountDto[]);

    return counts.sort((a, b) => b.count - a.count);
  }

  /**
   * Get user's reactions for a message
   */
  async getUserMessageReactions(
    messageId: string,
    userId: string,
  ): Promise<string[]> {
    const reactions = await this.find({
      where: { messageId, userId },
      select: ['type'],
    });
    return reactions.map((r) => r.type);
  }

  /**
   * Add a reaction
   */
  async addReaction(
    messageId: string,
    userId: string,
    type: string,
    isCustom: boolean = false,
  ): Promise<MessageReaction> {
    const reaction = this.create({
      messageId,
      userId,
      type,
      isCustom,
    });
    return this.save(reaction);
  }

  /**
   * Remove a specific reaction
   */
  async removeReaction(
    messageId: string,
    userId: string,
    type: string,
  ): Promise<boolean> {
    const result = await this.delete({
      messageId,
      userId,
      type,
    });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Remove all user reactions from a message
   */
  async removeAllUserReactions(
    messageId: string,
    userId: string,
  ): Promise<void> {
    await this.delete({ messageId, userId });
  }

  /**
   * Remove all reactions from a message
   */
  async removeAllMessageReactions(messageId: string): Promise<void> {
    await this.delete({ messageId });
  }

  /**
   * Get reactions count for multiple messages
   */
  async getReactionsCountForMessages(
    messageIds: string[],
  ): Promise<Map<string, ReactionCountDto[]>> {
    const reactions = await this.find({
      where: {
        messageId: messageIds.length > 0 ? In(messageIds) : undefined,
      },
    });

    const map = new Map<string, ReactionCountDto[]>();

    for (const messageId of messageIds) {
      const messageReactions = reactions.filter(
        (r) => r.messageId === messageId,
      );
      const counts = this.aggregateReactionCounts(messageReactions);
      map.set(messageId, counts);
    }

    return map;
  }

  /**
   * Get most popular reactions across all messages
   */
  async getPopularReactions(limit: number = 10): Promise<ReactionCountDto[]> {
    const reactions = await this.find({
      order: { createdAt: 'DESC' },
    });

    const counts = reactions.reduce((acc, reaction) => {
      const existing = acc.find((r) => r.type === reaction.type);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ type: reaction.type, count: 1 });
      }
      return acc;
    }, [] as ReactionCountDto[]);

    return counts.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  /**
   * Get user's total reactions count
   */
  async getUserReactionCount(userId: string): Promise<number> {
    return this.count({ where: { userId } });
  }

  /**
   * Helper method to aggregate reaction counts
   */
  private aggregateReactionCounts(
    reactions: MessageReaction[],
  ): ReactionCountDto[] {
    const counts = reactions.reduce((acc, reaction) => {
      const existing = acc.find((r) => r.type === reaction.type);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ type: reaction.type, count: 1 });
      }
      return acc;
    }, [] as ReactionCountDto[]);

    return counts.sort((a, b) => b.count - a.count);
  }
}
