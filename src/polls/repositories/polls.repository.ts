import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Poll, PollVote } from '../entities/poll.entity';

@Injectable()
export class PollsRepository extends Repository<Poll> {
  constructor(dataSource: DataSource) {
    super(Poll, dataSource.createEntityManager());
  }

  async findPollsByConversation(conversationId: string): Promise<Poll[]> {
    return this.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findNonClosedPolls(conversationId: string): Promise<Poll[]> {
    return this.find({
      where: { conversationId, isClosed: false },
      order: { expiresAt: 'ASC' },
    });
  }

  async findExpiredPolls(): Promise<Poll[]> {
    return this.createQueryBuilder('poll')
      .where('poll.expiresAt < NOW()')
      .andWhere('poll.isClosed = false')
      .getMany();
  }

  async aggregateVotes(pollId: string): Promise<Map<number, number>> {
    const votes = await this.getVotesForPoll(pollId);
    const voteMap = new Map<number, number>();

    for (const vote of votes) {
      for (const optionIndex of vote.optionIndexes) {
        voteMap.set(optionIndex, (voteMap.get(optionIndex) || 0) + 1);
      }
    }

    return voteMap;
  }

  private async getVotesForPoll(pollId: string): Promise<PollVote[]> {
    const connection = this.manager.connection;
    const pollVoteRepository = connection.getRepository(PollVote);

    return pollVoteRepository.find({
      where: { pollId },
    });
  }

  async getUserVoteForPoll(pollId: string, userId: string): Promise<PollVote | null> {
    const connection = this.manager.connection;
    const pollVoteRepository = connection.getRepository(PollVote);

    return pollVoteRepository.findOne({
      where: { pollId, userId },
    });
  }

  async countVotesForPoll(pollId: string): Promise<number> {
    const connection = this.manager.connection;
    const pollVoteRepository = connection.getRepository(PollVote);

    return pollVoteRepository.count({
      where: { pollId },
    });
  }

  async createVote(pollId: string, userId: string, optionIndexes: number[]): Promise<PollVote> {
    const connection = this.manager.connection;
    const pollVoteRepository = connection.getRepository(PollVote);

    const vote = pollVoteRepository.create({
      pollId,
      userId,
      optionIndexes,
    });

    return pollVoteRepository.save(vote);
  }

  async deleteVote(pollId: string, userId: string): Promise<void> {
    const connection = this.manager.connection;
    const pollVoteRepository = connection.getRepository(PollVote);

    await pollVoteRepository.delete({
      pollId,
      userId,
    });
  }
}
