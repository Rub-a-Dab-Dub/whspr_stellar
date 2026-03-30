import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { User } from '../users/entities/user.entity';
import { PollsService } from './polls.service';
import { PollsRepository } from './polls.repository';
import { Poll } from './entities/poll.entity';
import { PollVote } from './entities/poll-vote.entity';

describe('PollsService', () => {
  let service: PollsService;
  let pollsRepository: jest.Mocked<PollsRepository>;
  let conversationsRepository: jest.Mocked<Repository<Conversation>>;
  let participantsRepository: jest.Mocked<Repository<ConversationParticipant>>;
  let usersRepository: jest.Mocked<Repository<User>>;

  const now = new Date('2026-03-27T10:00:00.000Z');
  const pollId = '11111111-1111-1111-1111-111111111111';
  const conversationId = '22222222-2222-2222-2222-222222222222';
  const creatorId = '33333333-3333-3333-3333-333333333333';
  const voterId = '44444444-4444-4444-4444-444444444444';

  const basePoll: Poll = {
    id: pollId,
    conversationId,
    createdBy: creatorId,
    question: 'Best option?',
    options: ['Alpha', 'Beta', 'Gamma'],
    allowMultiple: false,
    isAnonymous: false,
    expiresAt: new Date('2026-03-28T10:00:00.000Z'),
    isClosed: false,
    conversation: {} as Conversation,
    creator: {} as User,
    votes: [],
    createdAt: new Date('2026-03-27T09:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(now);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService,
        {
          provide: PollsRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findVoteByPollAndUser: jest.fn(),
            findVotesByPoll: jest.fn(),
            saveVote: jest.fn(),
            createVote: jest.fn(),
            deleteVote: jest.fn(),
            getVoteAggregation: jest.fn(),
            findConversationPolls: jest.fn(),
            findExpiredOpenPolls: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Conversation),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(ConversationParticipant),
          useValue: { exist: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PollsService);
    pollsRepository = module.get(PollsRepository);
    conversationsRepository = module.get(getRepositoryToken(Conversation));
    participantsRepository = module.get(getRepositoryToken(ConversationParticipant));
    usersRepository = module.get(getRepositoryToken(User));

    conversationsRepository.findOne.mockResolvedValue({ id: conversationId } as Conversation);
    participantsRepository.exist.mockResolvedValue(true);
    pollsRepository.findOne.mockResolvedValue({ ...basePoll });
    pollsRepository.findVotesByPoll.mockResolvedValue([]);
    pollsRepository.getVoteAggregation.mockResolvedValue([]);
    usersRepository.find.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a poll with normalized options', async () => {
    const createdPoll = { ...basePoll, options: ['Alpha', 'Beta'] };
    pollsRepository.create.mockReturnValue(createdPoll);
    pollsRepository.save.mockResolvedValue(createdPoll);

    const result = await service.createPoll(creatorId, conversationId, {
      question: ' Favorite? ',
      options: [' Alpha ', 'Beta'],
      allowMultiple: true,
      isAnonymous: true,
      expiresAt: '2026-03-28T12:00:00.000Z',
    });

    expect(pollsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Favorite?',
        options: ['Alpha', 'Beta'],
        allowMultiple: true,
        isAnonymous: true,
      }),
    );
    expect(result.question).toBe('Favorite?');
  });

  it('rejects duplicate poll options', async () => {
    await expect(
      service.createPoll(creatorId, conversationId, {
        question: 'Favorite?',
        options: ['Alpha', 'alpha'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('casts a vote and includes named voters for non-anonymous polls', async () => {
    const vote: PollVote = {
      pollId,
      userId: voterId,
      optionIndexes: [1],
      votedAt: now,
      poll: basePoll,
      user: {} as User,
    };

    pollsRepository.findVoteByPollAndUser.mockResolvedValue(null);
    pollsRepository.createVote.mockReturnValue(vote);
    pollsRepository.saveVote.mockResolvedValue(vote);
    pollsRepository.findVotesByPoll.mockResolvedValue([vote]);
    pollsRepository.getVoteAggregation.mockResolvedValue([
      { optionIndex: 1, voteCount: 1, voterIds: [voterId] },
    ]);
    usersRepository.find.mockResolvedValue([
      { id: voterId, username: 'voter', displayName: 'Voter Name' } as User,
    ]);

    const result = await service.castVote(voterId, pollId, { optionIndexes: [1] });

    expect(pollsRepository.saveVote).toHaveBeenCalled();
    expect(result.totalVoters).toBe(1);
    expect(result.results[1].voters).toEqual([
      { userId: voterId, username: 'voter', displayName: 'Voter Name' },
    ]);
    expect(result.currentUserVote?.optionIndexes).toEqual([1]);
  });

  it('hides individual voters for anonymous polls', async () => {
    const anonymousPoll = { ...basePoll, isAnonymous: true, allowMultiple: true };
    const vote: PollVote = {
      pollId,
      userId: voterId,
      optionIndexes: [0, 2],
      votedAt: now,
      poll: anonymousPoll,
      user: {} as User,
    };

    pollsRepository.findOne.mockResolvedValue(anonymousPoll);
    pollsRepository.findVoteByPollAndUser.mockResolvedValue(null);
    pollsRepository.createVote.mockReturnValue(vote);
    pollsRepository.saveVote.mockResolvedValue(vote);
    pollsRepository.findVotesByPoll.mockResolvedValue([vote]);
    pollsRepository.getVoteAggregation.mockResolvedValue([
      { optionIndex: 0, voteCount: 1, voterIds: [voterId] },
      { optionIndex: 2, voteCount: 1, voterIds: [voterId] },
    ]);

    const result = await service.castVote(voterId, pollId, { optionIndexes: [0, 2] });

    expect(usersRepository.find).not.toHaveBeenCalled();
    expect(result.results[0].voters).toBeUndefined();
    expect(result.results[2].voters).toBeUndefined();
  });

  it('rejects multi-select votes for single-choice polls', async () => {
    await expect(service.castVote(voterId, pollId, { optionIndexes: [0, 1] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('retracts a vote before poll closure', async () => {
    pollsRepository.deleteVote.mockResolvedValue(1);

    const result = await service.retractVote(voterId, pollId);

    expect(pollsRepository.deleteVote).toHaveBeenCalledWith(pollId, voterId);
    expect(result.id).toBe(pollId);
  });

  it('prevents non-creators from closing a poll', async () => {
    await expect(service.closePoll(voterId, pollId)).rejects.toThrow(ForbiddenException);
  });

  it('auto-closes expired polls when accessed', async () => {
    const expiredPoll = { ...basePoll, expiresAt: new Date('2026-03-27T09:00:00.000Z') };
    pollsRepository.findOne.mockResolvedValue(expiredPoll);
    pollsRepository.save.mockResolvedValue({ ...expiredPoll, isClosed: true });

    await expect(service.getPoll(creatorId, pollId)).resolves.toMatchObject({ isClosed: true });
    expect(pollsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ isClosed: true }));
  });

  it('refuses to vote on expired polls', async () => {
    const expiredPoll = { ...basePoll, expiresAt: new Date('2026-03-27T09:00:00.000Z') };
    pollsRepository.findOne.mockResolvedValue(expiredPoll);
    pollsRepository.save.mockResolvedValue({ ...expiredPoll, isClosed: true });

    await expect(service.castVote(voterId, pollId, { optionIndexes: [0] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns conversation polls with current user votes', async () => {
    const vote: PollVote = {
      pollId,
      userId: creatorId,
      optionIndexes: [0],
      votedAt: now,
      poll: basePoll,
      user: {} as User,
    };

    pollsRepository.findConversationPolls.mockResolvedValue([{ ...basePoll }]);
    pollsRepository.findVotesByPoll.mockResolvedValue([vote]);
    pollsRepository.getVoteAggregation.mockResolvedValue([
      { optionIndex: 0, voteCount: 1, voterIds: [creatorId] },
    ]);
    usersRepository.find.mockResolvedValue([
      { id: creatorId, username: 'owner', displayName: 'Owner' } as User,
    ]);

    const result = await service.getPollsInConversation(creatorId, conversationId);

    expect(result).toHaveLength(1);
    expect(result[0].currentUserVote?.optionIndexes).toEqual([0]);
  });

  it('closes expired polls in bulk for the scheduled job', async () => {
    const expiredPoll = { ...basePoll, expiresAt: new Date('2026-03-27T09:00:00.000Z') };
    pollsRepository.findExpiredOpenPolls.mockResolvedValue([expiredPoll]);
    pollsRepository.save.mockResolvedValue([{ ...expiredPoll, isClosed: true }] as never);

    const result = await service.closeExpiredPolls(now);

    expect(pollsRepository.save).toHaveBeenCalledWith([expect.objectContaining({ isClosed: true })]);
    expect(result[0]).toMatchObject({ id: pollId, isClosed: true });
  });

  it('throws when the poll does not exist', async () => {
    pollsRepository.findOne.mockResolvedValue(null);

    await expect(service.getPoll(creatorId, pollId)).rejects.toThrow(NotFoundException);
  });
});
