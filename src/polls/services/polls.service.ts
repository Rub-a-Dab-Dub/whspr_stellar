import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PollsRepository } from '../repositories/polls.repository';
import { Poll, PollVote, PollOption } from '../entities/poll.entity';
import { CreatePollDto, CastVoteDto, PollResultResponseDto, PollListResponseDto } from '../dto/poll.dto';

/**
 * Service for managing polls and votes
 * Handles creation, voting, anonymous voting, and auto-expiration
 */
@Injectable()
export class PollsService {
  constructor(private readonly repository: PollsRepository) {}

  /**
   * Create a new poll with 2-10 options
   */
  async createPoll(
    conversationId: string,
    createdBy: string,
    dto: CreatePollDto,
  ): Promise<PollResultResponseDto> {
    // Validate options count
    if (dto.options.length < 2 || dto.options.length > 10) {
      throw new BadRequestException('Poll must have 2-10 options');
    }

    // Create options array with IDs
    const options: PollOption[] = dto.options.map((text, index) => ({
      id: index,
      text,
      voteCount: 0,
    }));

    const poll = this.repository.create({
      conversationId,
      createdBy,
      question: dto.question,
      options,
      allowMultiple: dto.allowMultiple || false,
      isAnonymous: dto.isAnonymous || false,
      expiresAt: dto.expiresAt || null,
      isClosed: false,
    });

    const saved = await this.repository.save(poll);
    return this.mapToResultDto(saved, false, 0);
  }

  /**
   * Cast or update a vote for a poll
   * Respects allowMultiple setting
   */
  async castVote(
    pollId: string,
    userId: string,
    dto: CastVoteDto,
  ): Promise<PollResultResponseDto> {
    const poll = await this.repository.findOneBy({ id: pollId });
    if (!poll) {
      throw new NotFoundException(`Poll ${pollId} not found`);
    }

    if (poll.isClosed) {
      throw new BadRequestException('This poll is closed');
    }

    // Check expiration
    if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
      throw new BadRequestException('This poll has expired');
    }

    // Validate option indices
    for (const idx of dto.optionIndexes) {
      if (idx < 0 || idx >= poll.options.length) {
        throw new BadRequestException(`Invalid option index: ${idx}`);
      }
    }

    // If not allowMultiple, only one option allowed
    if (!poll.allowMultiple && dto.optionIndexes.length > 1) {
      throw new BadRequestException('This poll only allows selecting one option');
    }

    // Remove existing vote
    await this.repository.deleteVote(pollId, userId);

    // Create new vote
    await this.repository.createVote(pollId, userId, dto.optionIndexes);

    return this.getPollResults(pollId, userId);
  }

  /**
   * Retract a vote before poll closes
   */
  async retractVote(pollId: string, userId: string): Promise<void> {
    const poll = await this.repository.findOneBy({ id: pollId });
    if (!poll) {
      throw new NotFoundException(`Poll ${pollId} not found`);
    }

    if (poll.isClosed) {
      throw new BadRequestException('Cannot retract vote - poll is closed');
    }

    const vote = await this.repository.getUserVoteForPoll(pollId, userId);
    if (!vote) {
      throw new NotFoundException('No vote found for this user on this poll');
    }

    await this.repository.deleteVote(pollId, userId);
  }

  /**
   * Close a poll (no more votes allowed)
   */
  async closePoll(pollId: string, userId: string): Promise<PollResultResponseDto> {
    const poll = await this.repository.findOneBy({ id: pollId });
    if (!poll) {
      throw new NotFoundException(`Poll ${pollId} not found`);
    }

    // Only creator can close
    if (poll.createdBy !== userId) {
      throw new BadRequestException('Only the poll creator can close the poll');
    }

    poll.isClosed = true;
    await this.repository.save(poll);

    return this.getPollResults(pollId, userId);
  }

  /**
   * Get poll details with vote results
   */
  async getPoll(pollId: string, userId?: string): Promise<PollResultResponseDto> {
    return this.getPollResults(pollId, userId);
  }

  /**
   * Get poll results with vote aggregation
   * Respects anonymity settings
   */
  async getPollResults(pollId: string, userId?: string): Promise<PollResultResponseDto> {
    const poll = await this.repository.findOneBy({ id: pollId });
    if (!poll) {
      throw new NotFoundException(`Poll ${pollId} not found`);
    }

    // Aggregate votes
    const voteMap = await this.repository.aggregateVotes(pollId);
    const totalVotes = await this.repository.countVotesForPoll(pollId);

    // Update options with vote counts
    const optionsWithCounts = poll.options.map((opt) => ({
      ...opt,
      voteCount: voteMap.get(opt.id) || 0,
    }));

    // Check if user voted
    let userVoted = false;
    if (userId) {
      const userVote = await this.repository.getUserVoteForPoll(pollId, userId);
      userVoted = !!userVote;
    }

    return this.mapToResultDto(
      { ...poll, options: optionsWithCounts },
      poll.isAnonymous,
      totalVotes,
      userVoted,
    );
  }

  /**
   * Get all polls in a conversation
   */
  async getPollsInConversation(conversationId: string): Promise<PollListResponseDto> {
    const polls = await this.repository.findPollsByConversation(conversationId);

    const data: PollResultResponseDto[] = [];
    for (const poll of polls) {
      data.push(
        await this.getPollResults(poll.id),
      );
    }

    return {
      data,
      total: data.length,
    };
  }

  /**
   * Scheduled job to auto-close expired polls
   */
  @Cron('0 * * * * *') // Every minute
  async autoCloseExpiredPolls(): Promise<void> {
    const expiredPolls = await this.repository.findExpiredPolls();

    for (const poll of expiredPolls) {
      poll.isClosed = true;
      await this.repository.save(poll);
      // TODO: Emit WebSocket event "poll:closed" to subscribers
    }
  }

  /**
   * Private helper: Map poll entity to response DTO
   */
  private mapToResultDto(
    poll: Poll,
    respectAnonymity: boolean,
    totalVotes?: number,
    userVoted?: boolean,
  ): PollResultResponseDto {
    const options = respectAnonymity
      ? poll.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          // Hide vote counts for anonymous polls
        }))
      : poll.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          voteCount: opt.voteCount || 0,
        }));

    return {
      id: poll.id,
      conversationId: poll.conversationId,
      createdBy: poll.createdBy,
      question: poll.question,
      options: options as any,
      allowMultiple: poll.allowMultiple,
      isAnonymous: poll.isAnonymous,
      expiresAt: poll.expiresAt,
      isClosed: poll.isClosed,
      totalVotes: totalVotes || 0,
      userVoted,
      createdAt: poll.createdAt,
      updatedAt: poll.updatedAt,
    };
  }
}
