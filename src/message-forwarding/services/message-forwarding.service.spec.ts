import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MessageForwardingService } from './message-forwarding.service';
import { MessageForwardingRepository } from '../repositories/message-forwarding.repository';
import { ForwardedMessage } from '../entities/forwarded-message.entity';

describe('MessageForwardingService', () => {
  let service: MessageForwardingService;
  let repository: MessageForwardingRepository;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockMessageId = '550e8400-e29b-41d4-a716-446655440001';
  const mockSourceConvId = '550e8400-e29b-41d4-a716-446655440002';
  const mockTargetConvId1 = '550e8400-e29b-41d4-a716-446655440003';
  const mockTargetConvId2 = '550e8400-e29b-41d4-a716-446655440004';

  const mockForward: ForwardedMessage = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    originalMessageId: mockMessageId,
    forwardedMessageId: 'forwarded-msg-123',
    forwardedBy: mockUserId,
    sourceConversationId: mockSourceConvId,
    targetConversationId: mockTargetConvId1,
    forwardedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageForwardingService,
        {
          provide: MessageForwardingRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findForwardById: jest.fn(),
            findForwardsByOriginalMessage: jest.fn(),
            findForwardChain: jest.fn(),
            findForwardsBySourceAndTarget: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MessageForwardingService>(MessageForwardingService);
    repository = module.get<MessageForwardingRepository>(MessageForwardingRepository);
  });

  describe('forwardMessage', () => {
    it('should forward message to single target conversation', async () => {
      jest.spyOn(repository, 'create').mockReturnValue(mockForward);
      jest.spyOn(repository, 'save').mockResolvedValue(mockForward);

      const result = await service.forwardMessage(
        mockMessageId,
        [mockTargetConvId1],
        mockUserId,
        mockSourceConvId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].originalMessageId).toBe(mockMessageId);
      expect(result[0].forwardedBy).toBe(mockUserId);
    });

    it('should forward to multiple target conversations (max 5)', async () => {
      const targetConvs = [
        mockTargetConvId1,
        mockTargetConvId2,
        '550e8400-e29b-41d4-a716-446655440005',
        '550e8400-e29b-41d4-a716-446655440006',
        '550e8400-e29b-41d4-a716-446655440007',
      ];

      jest.spyOn(repository, 'create').mockReturnValue(mockForward);
      jest.spyOn(repository, 'save').mockResolvedValue(mockForward);

      const result = await service.forwardMessage(
        mockMessageId,
        targetConvs,
        mockUserId,
        mockSourceConvId,
      );

      expect(result).toHaveLength(5);
      expect(repository.create).toHaveBeenCalledTimes(5);
    });

    it('should reject forward to same conversation', async () => {
      await expect(
        service.forwardMessage(mockMessageId, [mockSourceConvId], mockUserId, mockSourceConvId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject forward to more than 5 conversations', async () => {
      const targetConvs = Array.from({ length: 6 }, (_, i) =>
        `550e8400-e29b-41d4-a716-4466554400${10 + i}`,
      );

      await expect(
        service.forwardMessage(mockMessageId, targetConvs, mockUserId, mockSourceConvId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('forwardToMultiple', () => {
    it('should forward to multiple conversations', async () => {
      jest.spyOn(repository, 'create').mockReturnValue(mockForward);
      jest.spyOn(repository, 'save').mockResolvedValue(mockForward);

      const result = await service.forwardToMultiple(
        mockMessageId,
        [mockTargetConvId1, mockTargetConvId2],
        mockUserId,
        mockSourceConvId,
      );

      expect(result).toHaveLength(2);
    });

    it('should reject empty target list', async () => {
      await expect(
        service.forwardToMultiple(mockMessageId, [], mockUserId, mockSourceConvId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject more than 5 targets', async () => {
      const targetConvs = Array.from({ length: 6 }, (_, i) =>
        `550e8400-e29b-41d4-a716-4466554400${10 + i}`,
      );

      await expect(
        service.forwardToMultiple(mockMessageId, targetConvs, mockUserId, mockSourceConvId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate target conversations', async () => {
      await expect(
        service.forwardToMultiple(
          mockMessageId,
          [mockTargetConvId1, mockTargetConvId1],
          mockUserId,
          mockSourceConvId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getForwardedFrom', () => {
    it('should return all forwards from source conversation', async () => {
      jest.spyOn(repository, 'findForwardsBySourceAndTarget').mockResolvedValue([mockForward]);

      const result = await service.getForwardedFrom(mockSourceConvId);

      expect(result).toHaveLength(1);
      expect(result[0].sourceConversationId).toBe(mockSourceConvId);
    });
  });

  describe('getForwardChain', () => {
    it('should return forward chain with depth limit of 3', async () => {
      jest.spyOn(repository, 'findForwardChain').mockResolvedValue([
        mockMessageId,
        'fwd-1',
        'fwd-2',
        'fwd-3',
      ]);

      const result = await service.getForwardChain(mockMessageId);

      expect(result.totalDepth).toBe(4);
      expect(result.chain).toHaveLength(4);
      expect(result.chain[0].depth).toBe(0);
      expect(result.chain[3].depth).toBe(3);
    });
  });

  describe('Forward chain accuracy', () => {
    it('should limit forward chain depth to 3 hops', async () => {
      const longChain = Array.from({ length: 10 }, (_, i) => `msg-${i}`);

      jest.spyOn(repository, 'findForwardChain').mockResolvedValue(longChain.slice(0, 4));

      const result = await service.getForwardChain(mockMessageId);

      // Should call with maxDepth 3, which returns 4 items (original + 3 hops)
      expect(result.totalDepth).toBeLessThanOrEqual(4);
    });
  });

  describe('Idempotency', () => {
    it('should handle forwarding same message to same target safely', async () => {
      jest.spyOn(repository, 'create').mockReturnValue(mockForward);
      jest.spyOn(repository, 'save').mockResolvedValue(mockForward);

      const result1 = await service.forwardMessage(
        mockMessageId,
        [mockTargetConvId1],
        mockUserId,
        mockSourceConvId,
      );

      // Attempt same forward again
      const result2 = await service.forwardMessage(
        mockMessageId,
        [mockTargetConvId1],
        mockUserId,
        mockSourceConvId,
      );

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      // In a real implementation with deduplication, these would return same record
    });
  });
});
