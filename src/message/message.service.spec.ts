import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from './message.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessageEditHistory } from './entities/message-edit-history.entity';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ProfanityFilterService } from './services/profanity-filter.service';
import { NotificationService } from '../notifications/services/notification.service';

describe('MessageService', () => {
  let service: MessageService;
  let mockMessageRepo: any;
  let mockEditHistoryRepo: any;
  let mockProfanityFilterService: any;
  let mockNotificationService: any;
  let mockCacheManager: any;

  beforeEach(async () => {
    mockMessageRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockEditHistoryRepo = {
      save: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };

    mockProfanityFilterService = {
      containsProfanity: jest.fn().mockReturnValue(false),
    };

    mockNotificationService = {
      createMessageNotification: jest.fn(),
    };

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepo,
        },
        {
          provide: getRepositoryToken(MessageEditHistory),
          useValue: mockEditHistoryRepo,
        },
        {
          provide: ProfanityFilterService,
          useValue: mockProfanityFilterService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMessage', () => {
    it('should create a new message', async () => {
      const userId = 'test-user-id';
      const createDto = {
        conversationId: 'conv-id',
        roomId: 'room-id',
        content: 'Test message',
      };

      const message = {
        id: 'msg-id',
        ...createDto,
        authorId: userId,
        isEdited: false,
        originalContent: null,
      };

      mockMessageRepo.create.mockReturnValue(message);
      mockMessageRepo.save.mockResolvedValue(message);

      const result = await service.createMessage(createDto, userId);

      expect(mockMessageRepo.create).toHaveBeenCalledWith({
        conversationId: createDto.conversationId,
        roomId: createDto.roomId,
        authorId: userId,
        content: createDto.content,
        originalContent: null,
        isEdited: false,
        type: 'text',
        mediaUrl: null,
        fileName: null,
      });

      expect(result.content).toBe(createDto.content);
      expect(result.authorId).toBe(userId);
    });
  });

  describe('editMessage', () => {
    it('should edit a message if within time limit', async () => {
      const userId = 'test-user-id';
      const messageId = 'msg-id';
      const message = {
        id: messageId,
        authorId: userId,
        content: 'Old content',
        originalContent: null,
        isEdited: false,
        createdAt: new Date(),
        editHistory: [],
      };

      mockMessageRepo.findOne.mockResolvedValue(message);
      mockMessageRepo.save.mockResolvedValue({
        ...message,
        content: 'New content',
        isEdited: true,
        editedAt: new Date(),
      });

      const result = await service.editMessage(
        messageId,
        { content: 'New content' },
        userId,
      );

      expect(result.content).toBe('New content');
      expect(result.isEdited).toBe(true);
    });

    it('should throw ForbiddenException if not message owner', async () => {
      const messageId = 'msg-id';
      const message = {
        id: messageId,
        authorId: 'other-user-id',
        content: 'Old content',
      };

      mockMessageRepo.findOne.mockResolvedValue(message);

      await expect(
        service.editMessage(
          messageId,
          { content: 'New content' },
          'wrong-user-id',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if edit time limit exceeded', async () => {
      const userId = 'test-user-id';
      const messageId = 'msg-id';
      const oldDate = new Date();
      oldDate.setMinutes(oldDate.getMinutes() - 20); // 20 minutes ago

      const message = {
        id: messageId,
        authorId: userId,
        content: 'Old content',
        createdAt: oldDate,
      };

      mockMessageRepo.findOne.mockResolvedValue(message);

      await expect(
        service.editMessage(messageId, { content: 'New content' }, userId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('softDeleteMessage', () => {
    it('should soft delete a message', async () => {
      const userId = 'test-user-id';
      const messageId = 'msg-id';
      const message = {
        id: messageId,
        authorId: userId,
        isDeleted: false,
      };

      mockMessageRepo.findOne.mockResolvedValue(message);
      mockMessageRepo.save.mockResolvedValue({
        ...message,
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      });

      const result = await service.softDeleteMessage(messageId, userId);

      expect(result.isDeleted).toBe(true);
      expect(mockMessageRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not message owner', async () => {
      const messageId = 'msg-id';
      const message = {
        id: messageId,
        authorId: 'other-user-id',
      };

      mockMessageRepo.findOne.mockResolvedValue(message);

      await expect(
        service.softDeleteMessage(messageId, 'wrong-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getEditHistory', () => {
    it('should retrieve edit history for a message', async () => {
      const messageId = 'msg-id';
      const message = { id: messageId };
      const history = [
        {
          id: 'h1',
          messageId,
          previousContent: 'Content 1',
          newContent: 'Content 2',
          editedAt: new Date(),
        },
      ];

      mockMessageRepo.findOne.mockResolvedValue(message);
      mockEditHistoryRepo.find.mockResolvedValue(history);

      const result = await service.getEditHistory(messageId);

      expect(result).toHaveLength(1);
      expect(result[0].previousContent).toBe('Content 1');
    });
  });
});
