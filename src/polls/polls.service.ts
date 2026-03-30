import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { User } from '../users/entities/user.entity';
import { CastVoteDto } from './dto/cast-vote.dto';
import {
  PollOptionResultDto,
  PollRealtimePayloadDto,
  PollResponseDto,
  PollVoterDto,
} from './dto/poll-response.dto';
import { CreatePollDto } from './dto/create-poll.dto';
import { Poll } from './entities/poll.entity';
import { PollVote } from './entities/poll-vote.entity';
import { PollsRepository } from './polls.repository';

@Injectable()
export class PollsService {
  constructor(
    private readonly pollsRepository: PollsRepository,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantsRepository: Repository<ConversationParticipant>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async createPoll(
    userId: string,
    conversationId: string,
    dto: CreatePollDto,
  ): Promise<PollResponseDto> {
    await this.getConversationOrThrow(conversationId);
    await this.assertParticipant(conversationId, userId);

    const poll = this.pollsRepository.create({
      conversationId,
      createdBy: userId,
      question: dto.question.trim(),
      options: this.normalizeOptions(dto.options),
      allowMultiple: dto.allowMultiple ?? false,
      isAnonymous: dto.isAnonymous ?? false,
      expiresAt: this.parseExpiresAt(dto.expiresAt),
      isClosed: false,
    });

    const savedPoll = await this.pollsRepository.save(poll);
    return this.buildPollResponse(savedPoll, userId);
  }

  async castVote(userId: string, pollId: string, dto: CastVoteDto): Promise<PollResponseDto> {
    const poll = await this.getAuthorizedPoll(userId, pollId);
    await this.assertPollOpen(poll);

    const optionIndexes = this.normalizeVoteOptionIndexes(dto.optionIndexes, poll);
    const vote =
      (await this.pollsRepository.findVoteByPollAndUser(poll.id, userId)) ??
      this.pollsRepository.createVote({ pollId: poll.id, userId });

    vote.optionIndexes = optionIndexes;
    vote.votedAt = new Date();
    await this.pollsRepository.saveVote(vote);

    return this.buildPollResponse(poll, userId);
  }

  async retractVote(userId: string, pollId: string): Promise<PollResponseDto> {
    const poll = await this.getAuthorizedPoll(userId, pollId);
    await this.assertPollOpen(poll);

    const removed = await this.pollsRepository.deleteVote(poll.id, userId);
    if (!removed) {
      throw new NotFoundException('Vote not found.');
    }

    return this.buildPollResponse(poll, userId);
  }

  async closePoll(userId: string, pollId: string): Promise<PollResponseDto> {
    const poll = await this.getAuthorizedPoll(userId, pollId);
    if (poll.createdBy !== userId) {
      throw new ForbiddenException('Only the poll creator can close this poll.');
    }

    if (!poll.isClosed) {
      poll.isClosed = true;
      await this.pollsRepository.save(poll);
    }

    return this.buildPollResponse(poll, userId);
  }

  async getPoll(userId: string, pollId: string): Promise<PollResponseDto> {
    const poll = await this.getAuthorizedPoll(userId, pollId);
    return this.buildPollResponse(poll, userId);
  }

  getPollResults(userId: string, pollId: string): Promise<PollResponseDto> {
    return this.getPoll(userId, pollId);
  }

  async getPollRealtimePayload(pollId: string): Promise<PollRealtimePayloadDto> {
    const poll = await this.getPollOrThrow(pollId);
    await this.closePollIfExpired(poll);
    return this.buildRealtimePayload(poll);
  }

  async getPollsInConversation(userId: string, conversationId: string): Promise<PollResponseDto[]> {
    await this.getConversationOrThrow(conversationId);
    await this.assertParticipant(conversationId, userId);

    const polls = await this.pollsRepository.findConversationPolls(conversationId);
    for (const poll of polls) {
      await this.closePollIfExpired(poll);
    }

    return Promise.all(polls.map((poll) => this.buildPollResponse(poll, userId)));
  }

  async closeExpiredPolls(referenceTime = new Date()): Promise<PollRealtimePayloadDto[]> {
    const expiredPolls = await this.pollsRepository.findExpiredOpenPolls(referenceTime);
    if (expiredPolls.length === 0) {
      return [];
    }

    for (const poll of expiredPolls) {
      poll.isClosed = true;
    }

    await this.pollsRepository.save(expiredPolls);
    return Promise.all(expiredPolls.map((poll) => this.buildRealtimePayload(poll)));
  }

  private async buildPollResponse(poll: Poll, currentUserId: string): Promise<PollResponseDto> {
    const [aggregation, votes] = await Promise.all([
      this.pollsRepository.getVoteAggregation(poll.id),
      this.pollsRepository.findVotesByPoll(poll.id),
    ]);

    const votersByOption = await this.getVotersByOption(poll, aggregation);
    const currentUserVote = votes.find((vote) => vote.userId === currentUserId) ?? null;

    return {
      id: poll.id,
      conversationId: poll.conversationId,
      createdBy: poll.createdBy,
      question: poll.question,
      options: poll.options,
      allowMultiple: poll.allowMultiple,
      isAnonymous: poll.isAnonymous,
      expiresAt: poll.expiresAt,
      isClosed: poll.isClosed,
      createdAt: poll.createdAt,
      totalVoters: votes.length,
      results: poll.options.map((option, index) =>
        this.toOptionResult(index, option, aggregation, votersByOption),
      ),
      currentUserVote: currentUserVote
        ? {
            optionIndexes: [...currentUserVote.optionIndexes].sort((left, right) => left - right),
            votedAt: currentUserVote.votedAt,
          }
        : null,
    };
  }

  private async buildRealtimePayload(poll: Poll): Promise<PollRealtimePayloadDto> {
    const [aggregation, votes] = await Promise.all([
      this.pollsRepository.getVoteAggregation(poll.id),
      this.pollsRepository.findVotesByPoll(poll.id),
    ]);

    const votersByOption = await this.getVotersByOption(poll, aggregation);

    return {
      id: poll.id,
      conversationId: poll.conversationId,
      createdBy: poll.createdBy,
      question: poll.question,
      options: poll.options,
      allowMultiple: poll.allowMultiple,
      isAnonymous: poll.isAnonymous,
      expiresAt: poll.expiresAt,
      isClosed: poll.isClosed,
      createdAt: poll.createdAt,
      totalVoters: votes.length,
      results: poll.options.map((option, index) =>
        this.toOptionResult(index, option, aggregation, votersByOption),
      ),
    };
  }

  private async getVotersByOption(
    poll: Poll,
    aggregation: Array<{ optionIndex: number; voteCount: number; voterIds: string[] }>,
  ): Promise<Map<number, PollVoterDto[]>> {
    if (poll.isAnonymous) {
      return new Map();
    }

    const voterIds = [...new Set(aggregation.flatMap((row) => row.voterIds))];
    if (voterIds.length === 0) {
      return new Map();
    }

    const users = await this.usersRepository.find({
      where: { id: In(voterIds) },
      select: ['id', 'username', 'displayName'],
    });
    const usersById = new Map(users.map((user) => [user.id, user]));

    return new Map(
      aggregation.map((row) => [
        row.optionIndex,
        row.voterIds
          .map((userId) => usersById.get(userId))
          .filter((user): user is User => Boolean(user))
          .map((user) => ({
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
          })),
      ]),
    );
  }

  private toOptionResult(
    index: number,
    text: string,
    aggregation: Array<{ optionIndex: number; voteCount: number; voterIds: string[] }>,
    votersByOption: Map<number, PollVoterDto[]>,
  ): PollOptionResultDto {
    const match = aggregation.find((row) => row.optionIndex === index);

    return {
      index,
      text,
      voteCount: match?.voteCount ?? 0,
      voters: votersByOption.get(index),
    };
  }

  private async getAuthorizedPoll(userId: string, pollId: string): Promise<Poll> {
    const poll = await this.getPollOrThrow(pollId);
    await this.assertParticipant(poll.conversationId, userId);
    await this.closePollIfExpired(poll);
    return poll;
  }

  private async getPollOrThrow(pollId: string): Promise<Poll> {
    const poll = await this.pollsRepository.findOne({
      where: { id: pollId },
    });

    if (!poll) {
      throw new NotFoundException('Poll not found.');
    }

    return poll;
  }

  private async getConversationOrThrow(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    return conversation;
  }

  private async assertParticipant(conversationId: string, userId: string): Promise<void> {
    const isParticipant = await this.participantsRepository.exist({
      where: { conversationId, userId },
    });

    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this conversation.');
    }
  }

  private async closePollIfExpired(poll: Poll): Promise<void> {
    if (!poll.isClosed && poll.expiresAt && poll.expiresAt.getTime() <= Date.now()) {
      poll.isClosed = true;
      await this.pollsRepository.save(poll);
    }
  }

  private async assertPollOpen(poll: Poll): Promise<void> {
    await this.closePollIfExpired(poll);
    if (poll.isClosed) {
      throw new BadRequestException('Poll is closed.');
    }
  }

  private normalizeOptions(options: string[]): string[] {
    const normalized = options.map((option) => option.trim()).filter((option) => option.length > 0);
    if (normalized.length < 2 || normalized.length > 10) {
      throw new BadRequestException('Poll options must contain between 2 and 10 choices.');
    }

    const uniqueOptions = new Set(normalized.map((option) => option.toLowerCase()));
    if (uniqueOptions.size !== normalized.length) {
      throw new BadRequestException('Poll options must be unique.');
    }

    return normalized;
  }

  private parseExpiresAt(rawExpiresAt?: string): Date | null {
    if (!rawExpiresAt) {
      return null;
    }

    const expiresAt = new Date(rawExpiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Poll expiration date is invalid.');
    }

    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Poll expiration date must be in the future.');
    }

    return expiresAt;
  }

  private normalizeVoteOptionIndexes(optionIndexes: number[], poll: Poll): number[] {
    const uniqueIndexes = [...new Set(optionIndexes)].sort((left, right) => left - right);
    if (uniqueIndexes.length === 0) {
      throw new BadRequestException('At least one option must be selected.');
    }

    if (!poll.allowMultiple && uniqueIndexes.length > 1) {
      throw new BadRequestException('This poll only allows one option per vote.');
    }

    for (const optionIndex of uniqueIndexes) {
      if (optionIndex < 0 || optionIndex >= poll.options.length) {
        throw new BadRequestException('Selected option is invalid.');
      }
    }

    return uniqueIndexes;
  }
}
