import { Test, TestingModule } from '@nestjs/testing';
import { ReactionService } from './reaction.service';
import { ReactionRepository } from './repositories/reaction.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { RedisService } from '../redis/redis.service';
import { CacheService } from '../cache/cache.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { MessageReaction } from './entities/message-reaction.entity';
import { NotificationService } from '../notifications/services/notification.service';

describe('ReactionService', () => {
  let service: ReactionService;
  let reactionRepository: jest.Mocked<ReactionRepository>;
  let messageService: jest.Mocked<MessageService>;
  let redisService: jest.Mocked<RedisService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockMessage = {
    id: 'msg-1',
    authorId: 'user-1',
    content: 'Test message',
  };
  const mockReaction: MessageReaction = {
    id: 'react-1',
    messageId: 'msg-1',
    userId: 'user-2',
    type: '👍',
    isCustom: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    message: null,
    user: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionService,
        {
          provide: getRepositoryToken(MessageReaction),
          useValue: {
            findUserReaction: jest.fn(),
            addReaction: jest.fn(),
            removeReaction: jest.fn(),
            getReactionCounts: jest.fn(),
            getUserMessageReactions: jest.fn(),
            findReactionsByType: jest.fn(),
            getPopularReactions: jest.fn(),
            getReactionsCountForMessages: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: ReactionRepository,
          useExisting: getRepositoryToken(MessageReaction),
        },
        {
          provide: MessageService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            createReactionNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReactionService>(ReactionService);
    reactionRepository = module.get(ReactionRepository);
    messageService = module.get(MessageService);
    redisService = module.get(RedisService);
    cacheService = module.get(CacheService);
  });

  describe('addReaction', () => {
    it('should successfully add a reaction', async () => {
      messageService.findById.mockResolvedValue(mockMessage as any);
      reactionRepository.findUserReaction.mockResolvedValue(null);
      reactionRepository.addReaction.mockResolvedValue(mockReaction);

      const result = await service.addReaction('msg-1', 'user-2', '👍');

      expect(result.type).toBe('👍');
      expect(result.userId).toBe('user-2');
      expect(messageService.findById).toHaveBeenCalledWith('msg-1');
      expect(reactionRepository.addReaction).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if message does not exist', async () => {
      messageService.findById.mockResolvedValue(null);

      await expect(
        service.addReaction('msg-1', 'user-2', '👍'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if reaction already exists', async () => {
      messageService.findById.mockResolvedValue(mockMessage as any);
      reactionRepository.findUserReaction.mockResolvedValue(mockReaction);

      await expect(
        service.addReaction('msg-1', 'user-2', '👍'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeReaction', () => {
    it('should successfully remove a reaction', async () => {
      messageService.findById.mockResolvedValue(mockMessage as any);
      reactionRepository.removeReaction.mockResolvedValue(true);

      await service.removeReaction('msg-1', 'user-2', '👍');

      expect(reactionRepository.removeReaction).toHaveBeenCalledWith(
        'msg-1',
        'user-2',
        '👍',
      );
      expect(cacheService.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if message does not exist', async () => {
      messageService.findById.mockResolvedValue(null);

      await expect(
        service.removeReaction('msg-1', 'user-2', '👍'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if reaction does not exist', async () => {
      messageService.findById.mockResolvedValue(mockMessage as any);
      reactionRepository.removeReaction.mockResolvedValue(false);

      await expect(
        service.removeReaction('msg-1', 'user-2', '👍'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessageReactions', () => {
    it('should return cached reactions if available', async () => {
      const cachedReactions = {
        messageId: 'msg-1',
        reactions: [{ type: '👍', count: 5 }],
        totalReactions: 5,
        userReactions: [],
      };

      messageService.findById.mockResolvedValue(mockMessage as any);
      cacheService.get.mockResolvedValue(cachedReactions);

      const result = await service.getMessageReactions('msg-1');

      expect(result).toEqual(cachedReactions);
      expect(cacheService.get).toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      messageService.findById.mockResolvedValue(mockMessage as any);
      cacheService.get.mockResolvedValue(null);
      reactionRepository.getReactionCounts.mockResolvedValue([
        { type: '👍', count: 5 },
        { type: '❤️', count: 3 },
      ]);
      reactionRepository.getUserMessageReactions.mockResolvedValue(['👍']);

      const result = await service.getMessageReactions('msg-1', 'user-2');

      expect(result.totalReactions).toBe(8);
      expect(result.reactions.length).toBe(2);
      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe('getPopularReactions', () => {
    it('should return cached popular reactions if available', async () => {
      const cached = [{ type: '👍', count: 1000 }];

      cacheService.get.mockResolvedValue(cached);

      const result = await service.getPopularReactions(10);

      expect(result).toEqual(cached);
      expect(cacheService.get).toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      cacheService.get.mockResolvedValue(null);
      reactionRepository.getPopularReactions.mockResolvedValue([
        { type: '👍', count: 1000 },
        { type: '❤️', count: 800 },
      ]);

      const result = await service.getPopularReactions(10);

      expect(result.length).toBe(2);
      expect(result[0].type).toBe('👍');
      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe('userHasReaction', () => {
    it('should return true if user has reaction', async () => {
      reactionRepository.findUserReaction.mockResolvedValue(mockReaction);

      const result = await service.userHasReaction('msg-1', 'user-2', '👍');

      expect(result).toBe(true);
    });

    it('should return false if user does not have reaction', async () => {
      reactionRepository.findUserReaction.mockResolvedValue(null);

      const result = await service.userHasReaction('msg-1', 'user-2', '👍');

      expect(result).toBe(false);
    });
  });
});
