import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MessageReaction } from './entities/message-reaction.entity';
import { Message } from './entities/message.entity';
import { MessagesGateway } from './messages.gateway';

/** Default allowed emojis – overridable via ALLOWED_REACTION_EMOJIS env var (comma-separated) */
export const DEFAULT_ALLOWED_EMOJIS = [
  '🔥',
  '❤️',
  '😂',
  '😮',
  '😢',
  '👍',
  '👎',
];

export type ReactionSummary = Record<string, number>;

@Injectable()
export class ReactionsService {
  private readonly allowedEmojis: Set<string>;

  constructor(
    @InjectRepository(MessageReaction)
    private readonly reactionRepo: Repository<MessageReaction>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly messagesGateway: MessagesGateway,
    private readonly configService: ConfigService,
  ) {
    const envEmojis = this.configService.get<string>('ALLOWED_REACTION_EMOJIS');
    const list = envEmojis
      ? envEmojis
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
      : DEFAULT_ALLOWED_EMOJIS;
    this.allowedEmojis = new Set(list);
  }

  // ─── Add reaction ─────────────────────────────────────────────────────────

  async addReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<ReactionSummary> {
    if (!this.allowedEmojis.has(emoji)) {
      throw new BadRequestException(
        `Emoji "${emoji}" is not allowed. Allowed: ${[...this.allowedEmojis].join(' ')}`,
      );
    }

    // Verify message exists
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');

    // Try to insert – the unique constraint prevents duplicates
    try {
      await this.reactionRepo.insert({ messageId, userId, emoji });
    } catch (err: any) {
      // Postgres unique violation code 23505
      if (err?.code === '23505') {
        throw new ConflictException(
          'You have already reacted with this emoji on this message',
        );
      }
      throw err;
    }

    const summary = await this.getAggregated(messageId);
    this.messagesGateway.broadcastReactionUpdated(
      message.roomId,
      messageId,
      summary,
    );
    return summary;
  }

  // ─── Remove reaction ──────────────────────────────────────────────────────

  async removeReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<ReactionSummary> {
    if (!this.allowedEmojis.has(emoji)) {
      throw new BadRequestException(`Emoji "${emoji}" is not allowed`);
    }

    const reaction = await this.reactionRepo.findOne({
      where: { messageId, userId, emoji },
    });
    if (!reaction) throw new NotFoundException('Reaction not found');

    await this.reactionRepo.remove(reaction);

    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });
    const summary = await this.getAggregated(messageId);
    if (message) {
      this.messagesGateway.broadcastReactionUpdated(
        message.roomId,
        messageId,
        summary,
      );
    }
    return summary;
  }

  // ─── Aggregate ────────────────────────────────────────────────────────────

  /**
   * Returns aggregated reaction counts for a single message.
   * e.g. { "🔥": 3, "❤️": 1 }
   */
  async getAggregated(messageId: string): Promise<ReactionSummary> {
    const rows: { emoji: string; count: string }[] = await this.reactionRepo
      .createQueryBuilder('r')
      .select('r.emoji', 'emoji')
      .addSelect('COUNT(*)', 'count')
      .where('r.message_id = :messageId', { messageId })
      .groupBy('r.emoji')
      .getRawMany();

    return rows.reduce<ReactionSummary>(
      (acc, row) => ({ ...acc, [row.emoji]: parseInt(row.count, 10) }),
      {},
    );
  }

  /**
   * Bulk-fetch aggregated reactions for multiple message IDs.
   * Returns a map of messageId → ReactionSummary.
   */
  async getAggregatedBulk(
    messageIds: string[],
  ): Promise<Record<string, ReactionSummary>> {
    if (messageIds.length === 0) return {};

    const rows: { messageId: string; emoji: string; count: string }[] =
      await this.reactionRepo
        .createQueryBuilder('r')
        .select('r.message_id', 'messageId')
        .addSelect('r.emoji', 'emoji')
        .addSelect('COUNT(*)', 'count')
        .where('r.message_id IN (:...messageIds)', { messageIds })
        .groupBy('r.message_id, r.emoji')
        .getRawMany();

    const result: Record<string, ReactionSummary> = {};
    for (const row of rows) {
      if (!result[row.messageId]) result[row.messageId] = {};
      result[row.messageId][row.emoji] = parseInt(row.count, 10);
    }
    return result;
  }
}
