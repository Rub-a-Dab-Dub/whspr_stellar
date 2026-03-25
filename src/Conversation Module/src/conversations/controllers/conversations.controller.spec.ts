import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from '../services/conversations.service';
import { ConversationType } from '../entities/conversation.entity';
import { CreateConversationDto } from '../dto/create-conversation.dto';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let service: ConversationsService;

  const mockService = {
    createDirect: jest.fn(),
    createGroup: jest.fn(),
    getConversations: jest.fn(),
    getConversation: jest.fn(),
    archiveConversation: jest.fn(),
    markRead: jest.fn(),
    muteConversation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: ConversationsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ConversationsController>(ConversationsController);
    service = module.get<ConversationsService>(ConversationsService);
  });

  describe('createConversation', () => {
    it('should call createDirect if type is DIRECT', async () => {
      const dto: CreateConversationDto = { type: ConversationType.DIRECT, participants: ['u1', 'u2'] };
      await controller.createConversation(dto, 'u1');
      expect(service.createDirect).toHaveBeenCalledWith(dto, 'u1');
    });

    it('should call createGroup if type is GROUP', async () => {
      const dto: CreateConversationDto = { type: ConversationType.GROUP, groupId: 'g1', participants: ['u1', 'u2'] };
      await controller.createConversation(dto, 'u1');
      expect(service.createGroup).toHaveBeenCalledWith(dto, 'u1');
    });
  });

  describe('getConversations', () => {
    it('should call getConversations with query params', async () => {
      await controller.getConversations('u1', 10, 'cursor-1', true);
      expect(service.getConversations).toHaveBeenCalledWith('u1', 10, 'cursor-1', true);
    });
  });

  describe('getConversation', () => {
    it('should call getConversation', async () => {
      await controller.getConversation('c1', 'u1');
      expect(service.getConversation).toHaveBeenCalledWith('c1', 'u1');
    });
  });

  describe('archiveConversation', () => {
    it('should call archiveConversation', async () => {
      await controller.archiveConversation('c1', 'u1', true);
      expect(service.archiveConversation).toHaveBeenCalledWith('c1', 'u1', true);
    });
  });

  describe('markRead', () => {
    it('should call markRead', async () => {
      await controller.markRead('c1', 'u1');
      expect(service.markRead).toHaveBeenCalledWith('c1', 'u1');
    });
  });

  describe('muteConversation', () => {
    it('should call muteConversation', async () => {
      await controller.muteConversation('c1', 'u1', true);
      expect(service.muteConversation).toHaveBeenCalledWith('c1', 'u1', true);
    });
  });
});
