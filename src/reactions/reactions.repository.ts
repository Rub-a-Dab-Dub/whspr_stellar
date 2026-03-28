import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Reaction } from './entities/reaction.entity';

@Injectable()
export class ReactionsRepository extends Repository<Reaction> {
  constructor(private readonly dataSource: DataSource) {
    super(Reaction, dataSource.createEntityManager());
  }

  async findOneByMessageUserEmoji(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<Reaction | null> {
    return this.findOne({ where: { messageId, userId, emoji } });
  }

  async addReaction(messageId: string, userId: string, emoji: string): Promise<Reaction> {
    const existing = await this.findOneByMessageUserEmoji(messageId, userId, emoji);
    if (existing) {
      return existing;
    }

    const reaction = this.create({ messageId, userId, emoji });
    return this.save(reaction);
  }

  async removeReaction(messageId: string, userId: string, emoji: string): Promise<number> {
    const result = await this.delete({ messageId, userId, emoji });
    return result.affected ?? 0;
  }

  async getReactions(messageId: string): Promise<Reaction[]> {
    return this.find({
      where: { messageId },
      order: { createdAt: 'DESC' },
    });
  }

  async getReactionSummary(messageId: string): Promise<
    Array<{
      emoji: string;
      count: number;
      sampleUsers: string[];
    }>
  > {
    const rows = await this.createQueryBuilder('reaction')
      .select('reaction.emoji', 'emoji')
      .addSelect('COUNT(1)::int', 'count')
      .addSelect('ARRAY_AGG(reaction.userId ORDER BY reaction.createdAt DESC)', 'users')
      .where('reaction.messageId = :messageId', { messageId })
      .groupBy('reaction.emoji')
      .orderBy('COUNT(1)', 'DESC')
      .addOrderBy('reaction.emoji', 'ASC')
      .getRawMany<{ emoji: string; count: number | string; users: string[] | string | null }>();

    return rows.map((row) => ({
      emoji: row.emoji,
      count: typeof row.count === 'string' ? parseInt(row.count, 10) : row.count,
      sampleUsers: this.toUserArray(row.users).slice(0, 3),
    }));
  }

  private toUserArray(value: string[] | string | null): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    const normalized = value.trim();
    if (!normalized.startsWith('{') || !normalized.endsWith('}')) {
      return normalized.length ? [normalized] : [];
    }

    const inner = normalized.slice(1, -1).trim();
    if (!inner) return [];

    return inner.split(',').map((part) => part.replace(/^"|"$/g, '').trim());
  }
}
