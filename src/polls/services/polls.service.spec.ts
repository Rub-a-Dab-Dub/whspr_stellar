import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PollsService } from './polls.service';
import { PollsRepository } from '../repositories/polls.repository';
import { Poll, PollVote, PollOption } from '../entities/poll.entity';

describe('PollsService', () => {
  let service: PollsService;
  let repository: PollsRepository;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockConversationId = '550e8400-e29b-41d4-a716-446655440001';
  const mockPollId = '550e8400-e29b-41d4-a716-446655440002';

  const mockPoll: Poll = {
    id: mockPollId,
    conversationId: mockConversationId,
    createdBy: mockUserId,
    question: 'What is your favorite color?',
    options: [
      { id: 0, text: 'Red', voteCount: 2 },
      { id: 1, text: 'Blue', voteCount: 3 },
      { id: 2, text: 'Green', voteCount: 1 },
    ],
    allowMultiple: false,
    isAnonymous: false,
    expiresAt: null,
    isClosed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    votes: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService,
        {
          provide: PollsRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOneBy: jest.fn(),
            findPollsByConversation: jest.fn(),
            findExpiredPolls: jest.fn(),
            aggregateVotes: jest.fn(),
            getUserVoteForPoll: jest.fn(),
            countVotesForPoll: jest.fn(),
            createVote: jest.fn(),
            deleteVote: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
    repository = module.get<PollsRepository>(PollsRepository);
  });

  describe('createPoll', () => {
    it('should create poll with 2-10 options', async () => {
      const dto = {
        question: 'Favorite color?',
        options: ['Red', 'Blue', 'Green'],
        allowMultiple: false,
        isAnonymous: false,
      };

      jest.spyOn(repository, 'create').mockReturnValue({
        ...mockPoll,
        options: dto.options.map((text, idx) => ({ id: idx, text, voteCount: 0 })),
      });
      jest.spyOn(repository, 'save').mockResolvedValue(mockPoll);
      jest.spyOn(repository, 'aggregateVotes').mockResolvedValue(new Map());
      jest.spyOn(repository, 'countVotesForPoll').mockResolvedValue(0);

      const result = await service.createPoll(mockConversationId, mockUserId, dto);

      expect(result.question).toBe(dto.question);
      expect(result.options.length).toBe(3);
      expect(result.isClosed).toBe(false);
    });

    it('should reject poll with less than 2 options', async () => {
      const dto = {
        question: 'Only one?',
        options: ['Only one'],
      };

      await expect(service.createPoll(mockConversationId, mockUserId, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject poll with more than 10 options', async () => {
      const dto = {
        question: 'Too many?',
        options: Array.from({ length: 11 }, (_, i) => `Option ${i}`),
      };

      await expect(service.createPoll(mockConversationId, mockUserId, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('castVote', () => {
    it('should cast vote on single-choice poll', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockPoll);
      jest.spyOn(repository, 'deleteVote').mockResolvedValue(undefined);
      jest.spyOn(repository, 'createVote').mockResolvedValue({} as any);
      jest.spyOn(repository, 'aggregateVotes').mockResolvedValue(new Map([[0, 1]]));
      jest.spyOn(repository, 'countVotesForPoll').mockResolvedValue(1);
      jest.spyOn(repository, 'getUserVoteForPoll').mockResolvedValue({}  as any);

      const dto = { optionIndexes: [0] };
      const result = await service.castVote(mockPollId, mockUserId, dto);

      expect(repository.createVote).toHaveBeenCalledWith(mockPollId, mockUserId, [0]);
      expect(result.totalVotes).toBe(1);
    });

    it('should cast multiple votes on multi-choice poll', async () => {
      const multiPoll = { ...mockPoll, allowMultiple: true };

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(multiPoll);
      jest.spyOn(repository, 'deleteVote').mockResolvedValue(undefined);
      jest.spyOn(repository, 'createVote').mockResolvedValue({} as any);
      jest.spyOn(repository, 'aggregateVotes').mockResolvedValue(new Map());
      jest.spyOn(repository, 'countVotesForPoll').mockResolvedValue(1);
      jest.spyOn(repository, 'getUserVoteForPoll').mockResolvedValue({} as any);

      const dto = { optionIndexes: [0, 1] };
      const result = await service.castVote(mockPollId, mockUserId, dto);

      expect(repository.createVote).toHaveBeenCalledWith(mockPollId, mockUserId, [0, 1]);
    });

    it('should reject multiple votes on single-choice poll', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockPoll);

      const dto = { optionIndexes: [0, 1] };

      await expect(service.castVote(mockPollId, mockUserId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject vote on closed poll', async () => {
      const closedPoll = { ...mockPoll, isClosed: true };

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(closedPoll);

      const dto = { optionIndexes: [0] };

      await expect(service.castVote(mockPollId, mockUserId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject vote on expired poll', async () => {
      const expiredPoll = { ...mockPoll, expiresAt: new Date(Date.now() - 1000) };

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(expiredPoll);

      const dto = { optionIndexes: [0] };

      await expect(service.castVote(mockPollId, mockUserId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject invalid option index', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockPoll);

      const dto = { optionIndexes: [99] }; // Out of range

      await expect(service.castVote(mockPollId, mockUserId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('retractVote', () => {
    it('should retract vote before poll closes', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockPoll);
      jest.spyOn(repository, 'getUserVoteForPoll').mockResolvedValue({} as any);
      jest.spyOn(repository, 'deleteVote').mockResolvedValue(undefined);

      await service.retractVote(mockPollId, mockUserId);

      expect(repository.deleteVote).toHaveBeenCalledWith(mockPollId, mockUserId);
    });

    it('should reject retract on closed poll', async () => {
      const closedPoll = { ...mockPoll, isClosed: true };

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(closedPoll);

      await expect(service.retractVote(mockPollId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject retract when no vote exists', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockPoll);
      jest.spyOn(repository, 'getUserVoteForPoll').mockResolvedValue(null);

      await expect(service.retractVote(mockPollId, mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('closePoll', () => {
    it('should close poll if user is creator', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockPoll);
      jest.spyOn(repository, 'save').mockResolvedValue({ ...mockPoll, isClosed: true });
      jest.spyOn(repository, 'aggregateVotes').mockResolvedValue(new Map());
      jest.spyOn(repository, 'countVotesForPoll').mockResolvedValue(0);

      const result = await service.closePoll(mockPollId, mockUserId);

      expect(result.isClosed).toBe(true);
    });

    it('should reject close if user is not creator', async () => {
      const otherUserId = '550e8400-e29b-41d4-a716-446655440999';

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockPoll);

      await expect(service.closePoll(mockPollId, otherUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Anonymous polls', () => {
    it('should hide vote counts for anonymous polls', async () => {
      const anonPoll = { ...mockPoll, isAnonymous: true };

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(anonPoll);
      jest.spyOn(repository, 'aggregateVotes').mockResolvedValue(new Map());
      jest.spyOn(repository, 'countVotesForPoll').mockResolvedValue(5);
      jest.spyOn(repository, 'getUserVoteForPoll').mockResolvedValue(null);

      const result = await service.getPollResults(mockPollId, mockUserId);

      // Vote counts should not be included
      expect(result.options.some((opt) => 'voteCount' in opt && opt.voteCount !== undefined)).toBe(
        false,
      );
    });
  });

  describe('Vote aggregation', () => {
    it('should accurately count votes across all options', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockPoll);
      jest
        .spyOn(repository, 'aggregateVotes')
        .mockResolvedValue(new Map([[0, 5], [1, 3], [2, 2]]));
      jest.spyOn(repository, 'countVotesForPoll').mockResolvedValue(10);
      jest.spyOn(repository, 'getUserVoteForPoll').mockResolvedValue(null);

      const result = await service.getPollResults(mockPollId, mockUserId);

      expect(result.totalVotes).toBe(10);
    });
  });
});
