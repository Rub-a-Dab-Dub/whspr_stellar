import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Poll } from './entities/poll.entity';
import { PollVote } from './entities/poll-vote.entity';

type PollVoteAggregationRow = {
  optionIndex: number;
  voteCount: number;
  voterIds: string[];
};

@Injectable()
export class PollsRepository extends Repository<Poll> {
  private readonly votesRepository: Repository<PollVote>;

  constructor(private readonly dataSource: DataSource) {
    super(Poll, dataSource.createEntityManager());
    this.votesRepository = dataSource.getRepository(PollVote);
  }

  findVoteByPollAndUser(pollId: string, userId: string): Promise<PollVote | null> {
    return this.votesRepository.findOne({
      where: { pollId, userId },
    });
  }

  findVotesByPoll(pollId: string): Promise<PollVote[]> {
    return this.votesRepository.find({
      where: { pollId },
      order: { votedAt: 'DESC' },
    });
  }

  saveVote(vote: PollVote): Promise<PollVote> {
    return this.votesRepository.save(vote);
  }

  createVote(partial: Partial<PollVote>): PollVote {
    return this.votesRepository.create(partial);
  }

  async deleteVote(pollId: string, userId: string): Promise<number> {
    const result = await this.votesRepository.delete({ pollId, userId });
    return result.affected ?? 0;
  }

  async getVoteAggregation(pollId: string): Promise<PollVoteAggregationRow[]> {
    const rows = await this.dataSource.query(
      `
        SELECT
          expanded.option_index AS "optionIndex",
          COUNT(*)::int AS "voteCount",
          ARRAY_AGG(expanded."userId" ORDER BY expanded."votedAt" DESC) AS "voterIds"
        FROM (
          SELECT
            "userId",
            "votedAt",
            unnest("optionIndexes") AS option_index
          FROM "poll_votes"
          WHERE "pollId" = $1
        ) expanded
        GROUP BY expanded.option_index
        ORDER BY expanded.option_index ASC
      `,
      [pollId],
    );

    return rows.map((row: Record<string, unknown>) => ({
      optionIndex: this.toNumber(row.optionIndex),
      voteCount: this.toNumber(row.voteCount),
      voterIds: this.toArray(row.voterIds),
    }));
  }

  findConversationPolls(conversationId: string): Promise<Poll[]> {
    return this.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });
  }

  findExpiredOpenPolls(referenceTime: Date): Promise<Poll[]> {
    return this.createQueryBuilder('poll')
      .where('poll.isClosed = :isClosed', { isClosed: false })
      .andWhere('poll.expiresAt IS NOT NULL')
      .andWhere('poll.expiresAt <= :referenceTime', { referenceTime })
      .getMany();
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    return parseInt(String(value), 10);
  }

  private toArray(value: unknown): string[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.map((entry) => String(entry));
    }

    const normalized = String(value).trim();
    if (!normalized.startsWith('{') || !normalized.endsWith('}')) {
      return normalized.length ? [normalized] : [];
    }

    const inner = normalized.slice(1, -1).trim();
    if (!inner) {
      return [];
    }

    return inner.split(',').map((part) => part.replace(/^"|"$/g, '').trim());
  }
}
