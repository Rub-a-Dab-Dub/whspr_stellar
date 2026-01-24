import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageOwnershipGuard } from './guards/message-ownership.guard';

describe('MessageController', () => {
  let controller: MessageController;
  let service: MessageService;

  const mockMessageService = {
    createMessage: jest.fn(),
    findByIdOrFail: jest.fn(),
    getConversationMessages: jest.fn(),
    editMessage: jest.fn(),
    softDeleteMessage: jest.fn(),
    hardDeleteMessage: jest.fn(),
    restoreMessage: jest.fn(),
    getEditHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageController],
      providers: [
        {
          provide: MessageService,
          useValue: mockMessageService,
        },
        MessageOwnershipGuard,
      ],
    })
      .overrideGuard(MessageOwnershipGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MessageController>(MessageController);
    service = module.get<MessageService>(MessageService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createMessage', () => {
    it('should create a message', async () => {
      const createDto = {
        conversationId: 'conv-id',
        content: 'Test message',
      };
      const request = { user: { id: 'user-id' } };
      const expected = { id: 'msg-id', ...createDto };

      mockMessageService.createMessage.mockResolvedValue(expected);

      const result = await controller.createMessage(createDto, request);

      expect(mockMessageService.createMessage).toHaveBeenCalledWith(
        createDto,
        'user-id',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getMessageById', () => {
    it('should retrieve a message by id', async () => {
      const messageId = 'msg-id';
      const expected = { id: messageId, content: 'Test message' };

      mockMessageService.findByIdOrFail.mockResolvedValue(expected);

      const result = await controller.getMessageById(messageId);

      expect(mockMessageService.findByIdOrFail).toHaveBeenCalledWith(messageId);
    });
  });

  describe('getConversationMessages', () => {
    it('should retrieve conversation messages', async () => {
      const conversationId = 'conv-id';
      const expected = {
        messages: [],
        total: 0,
        page: 1,
      };

      mockMessageService.getConversationMessages.mockResolvedValue(expected);

      const result = await controller.getConversationMessages(conversationId);

      expect(mockMessageService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        1,
        50,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('editMessage', () => {
    it('should edit a message', async () => {
      const messageId = 'msg-id';
      const updateDto = { content: 'Updated content' };
      const request = { user: { id: 'user-id' } };
      const expected = { id: messageId, ...updateDto, isEdited: true };

      mockMessageService.editMessage.mockResolvedValue(expected);

      const result = await controller.editMessage(
        messageId,
        updateDto,
        request,
      );

      expect(mockMessageService.editMessage).toHaveBeenCalledWith(
        messageId,
        updateDto,
        'user-id',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('softDeleteMessage', () => {
    it('should soft delete a message', async () => {
      const messageId = 'msg-id';
      const request = { user: { id: 'user-id' } };
      const deletedMsg = { id: messageId, isDeleted: true };

      mockMessageService.softDeleteMessage.mockResolvedValue(deletedMsg);

      const result = await controller.softDeleteMessage(messageId, request);

      expect(mockMessageService.softDeleteMessage).toHaveBeenCalledWith(
        messageId,
        'user-id',
      );
      expect(result.deletedMessage).toEqual(deletedMsg);
    });
  });

  describe('getEditHistory', () => {
    it('should retrieve edit history', async () => {
      const messageId = 'msg-id';
      const expected = [];

      mockMessageService.getEditHistory.mockResolvedValue(expected);

      const result = await controller.getEditHistory(messageId);

      expect(mockMessageService.getEditHistory).toHaveBeenCalledWith(messageId);
      expect(result).toEqual(expected);
    });
  });
});
