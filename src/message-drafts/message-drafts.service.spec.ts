import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MessageDraftsService } from './message-drafts.service';
import { MessageDraft } from './entities/message-draft.entity';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import { SaveDraftDto } from './dto/save-draft.dto';

const USER_ID = 'user-uuid-1';
const CONV_ID = 'conv-uuid-1';

const mockDraft: MessageDraft = {
  id: 'draft-uuid-1',
  userId: USER_ID,
  conversationId: CONV_ID,
  content: 'Hello draft',
  attachmentIds: null,
  replyToId: null,
  updatedAt: new Date('2026-01-01'),
};

const mockQueryBuilder = {
  insert: jest.fn().mockReturnThis(),
  into: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orUpdate: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({}),
};

const mockRepo = {
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
  findOneOrFail: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  delete: jest.fn(),
};

const mockChatGateway = {
  server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
};

describe('MessageDraftsService', () => {
  let service: MessageDraftsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageDraftsService,
        { provide: getRepositoryToken(MessageDraft), useValue: mockRepo },
        { provide: ChatGateway, useValue: mockChatGateway },
      ],
    }).compile();

    service = module.get(MessageDraftsService);
  });

  // ─── saveDraft ──────────────────────────────────────────────────────────────

  describe('saveDraft', () => {
    const dto: SaveDraftDto = { content: 'Hello draft' };

    it('upserts and returns the draft', async () => {
      mockRepo.findOneOrFail.mockResolvedValue(mockDraft);

      const result = await service.saveDraft(USER_ID, CONV_ID, dto);

      expect(mockQueryBuilder.execute).toHaveBeenCalled();
      expect(mockRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { userId: USER_ID, conversationId: CONV_ID },
      });
      expect(result.content).toBe('Hello draft');
      expect(result.userId).toBe(USER_ID);
    });

    it('passes attachmentIds and replyToId through', async () => {
      const richDto: SaveDraftDto = {
        content: 'With attachments',
        attachmentIds: ['att-1'],
        replyToId: 'reply-uuid',
      };
      mockRepo.findOneOrFail.mockResolvedValue({
        ...mockDraft,
        content: richDto.content,
        attachmentIds: ['att-1'],
        replyToId: 'reply-uuid',
      });

      const result = await service.saveDraft(USER_ID, CONV_ID, richDto);

      expect(mockQueryBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({ attachmentIds: ['att-1'], replyToId: 'reply-uuid' }),
      );
      expect(result.attachmentIds).toEqual(['att-1']);
    });
  });

  // ─── getDraft ───────────────────────────────────────────────────────────────

  describe('getDraft', () => {
    it('returns draft when found', async () => {
      mockRepo.findOne.mockResolvedValue(mockDraft);
      const result = await service.getDraft(USER_ID, CONV_ID);
      expect(result.id).toBe(mockDraft.id);
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.getDraft(USER_ID, CONV_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteDraft ────────────────────────────────────────────────────────────

  describe('deleteDraft', () => {
    it('deletes and triggers sync broadcast', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 });
      await service.deleteDraft(USER_ID, CONV_ID);
      expect(mockRepo.delete).toHaveBeenCalledWith({ userId: USER_ID, conversationId: CONV_ID });
    });

    it('is idempotent when draft does not exist', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.deleteDraft(USER_ID, CONV_ID)).resolves.toBeUndefined();
    });
  });

  // ─── getAllDrafts ────────────────────────────────────────────────────────────

  describe('getAllDrafts', () => {
    it('returns all drafts for user', async () => {
      mockRepo.find.mockResolvedValue([mockDraft]);
      const result = await service.getAllDrafts(USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(USER_ID);
    });

    it('returns empty array when no drafts', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.getAllDrafts(USER_ID);
      expect(result).toEqual([]);
    });
  });

  // ─── deleteDraftOnSend ──────────────────────────────────────────────────────

  describe('deleteDraftOnSend', () => {
    it('delegates to deleteDraft', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 });
      const spy = jest.spyOn(service, 'deleteDraft');
      await service.deleteDraftOnSend(USER_ID, CONV_ID);
      expect(spy).toHaveBeenCalledWith(USER_ID, CONV_ID);
    });
  });
});
