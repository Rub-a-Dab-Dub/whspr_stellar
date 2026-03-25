import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { Conversation, ConversationType } from '../entities/conversation.entity';
import { ConversationParticipant } from '../entities/conversation-participant.entity';
import { Message } from '../entities/message.entity';
import { CreateConversationDto } from '../dto/create-conversation.dto';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let conversationRepo: any;
  let participantRepo: any;
  let messageRepo: any;

  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getCount: jest.fn(),
    subQuery: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    getQuery: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: {
            create: jest.fn().mockImplementation((d) => ({ ...d, id: 'uuid' })),
            save: jest.fn().mockImplementation((c) => Promise.resolve({ ...c, id: 'uuid' })),
            findOne: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(ConversationParticipant),
          useValue: {
            create: jest.fn().mockImplementation((d) => d),
            save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            create: jest.fn().mockImplementation((d) => d),
            save: jest.fn().mockImplementation((m) => Promise.resolve({ ...m, createdAt: new Date() })),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    conversationRepo = module.get(getRepositoryToken(Conversation));
    participantRepo = module.get(getRepositoryToken(ConversationParticipant));
    messageRepo = module.get(getRepositoryToken(Message));
  });

  describe('createDirect', () => {
    it('should throw ConflictException if trying to create for someone else', async () => {
      // Actually my check is currentUserId must be one of participants
      const dto: CreateConversationDto = { type: ConversationType.DIRECT, participants: ['u2', 'u3'] };
      await expect(service.createDirect(dto, 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createGroup', () => {
    it('should throw BadRequestException if type is not GROUP', async () => {
      const dto: CreateConversationDto = { type: ConversationType.DIRECT, participants: [] };
      await expect(service.createGroup(dto, 'u1')).rejects.toThrow(BadRequestException);
    });
    it('should throw BadRequestException if groupId is missing', async () => {
      const dto: CreateConversationDto = { type: ConversationType.GROUP, participants: [] };
      await expect(service.createGroup(dto, 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getConversations', () => {
    it('should return paginated conversations', async () => {
      const mockConvos = [
        { id: '1', participants: [{ userId: 'u1' }], createdAt: new Date() },
        { id: '2', participants: [{ userId: 'u1' }], createdAt: new Date() },
      ];
      mockQueryBuilder.getMany.mockResolvedValueOnce(mockConvos);
      jest.spyOn(service as any, 'calculateUnreadCount').mockResolvedValue(0);

      const result = await service.getConversations('u1', 1, undefined);
      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBe('1');
    });

    it('should handle cursor', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);
      await service.getConversations('u1', 20, 'cursor-id');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(expect.stringContaining('.id > :cursor'), { cursor: 'cursor-id' });
    });
  });

  describe('getConversation', () => {
    it('should return a conversation if user is participant', async () => {
      const convo = { id: 'c1', participants: [{ userId: 'u1' }], createdAt: new Date() };
      conversationRepo.findOne.mockResolvedValueOnce(convo);
      jest.spyOn(service as any, 'calculateUnreadCount').mockResolvedValue(2);

      const result = await service.getConversation('c1', 'u1');
      expect(result.id).toBe('c1');
      expect(result.unreadCount).toBe(2);
    });

    it('should throw BadRequestException if user is not participant', async () => {
      const convo = { id: 'c1', participants: [{ userId: 'u2' }] };
      conversationRepo.findOne.mockResolvedValueOnce(convo);
      await expect(service.getConversation('c1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('muteConversation', () => {
    it('should mute/unmute conversation', async () => {
      const part = { userId: 'u1', isMuted: false };
      participantRepo.findOne.mockResolvedValueOnce(part);
      await service.muteConversation('c1', 'u1', true);
      expect(part.isMuted).toBe(true);
      expect(participantRepo.save).toHaveBeenCalledWith(part);
    });

    it('should throw NotFoundException if participant not found', async () => {
      participantRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.muteConversation('c1', 'u1', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendMessage (Helper)', () => {
    it('should save message and update conversation lastMessageAt', async () => {
      await service.sendMessage('c1', 'u1', 'Hello');
      expect(messageRepo.save).toHaveBeenCalled();
      expect(conversationRepo.update).toHaveBeenCalledWith('c1', { lastMessageAt: expect.any(Date) });
    });
  });

  describe('calculateUnreadCount (Edge cases)', () => {
    it('should return 0 if participant not found', async () => {
      participantRepo.findOne.mockResolvedValueOnce(null);
      const res = await (service as any).calculateUnreadCount('c1', 'u1');
      expect(res).toBe(0);
    });
  });
});
