import { Test, TestingModule } from '@nestjs/testing';
import { Cache } from 'cache-manager';
import { FeedbackService } from './feedback.service';
import { FeedbackReportRepository } from './feedback-report.repository';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackType, FeedbackPriority } from './entities/feedback-report.entity';
import { LegalEmailService } from '../legal/legal-email.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let mockRepo: jest.Mocked<FeedbackReportRepository>;
  let mockAttachments: jest.Mocked<any>;
  let mockEmail: jest.Mocked<LegalEmailService>;
  let mockCache: jest.Mocked<Cache>;

  const mockReq = {
    headers: {
      'x-app-version': '2.3.1',
      'x-platform': 'android',
      'x-device-info': JSON.stringify({ os: 'Android 13', model: 'Pixel 7' }),
    },
  } as any;

  beforeEach(async () => {
    mockRepo = {
      createAndSave: jest.fn(),
      findById: jest.fn(),
      getFeedbackQueue: jest.fn(),
      getStats: jest.fn(),
      update: jest.fn(),
    } as any;

    mockAttachments = {} as any;
    mockEmail = { sendBugReportEmail: jest.fn().mockResolvedValue(undefined) } as any;
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: FeedbackReportRepository, useValue: mockRepo },
        { provide: 'AttachmentsService', useValue: mockAttachments },
        { provide: LegalEmailService, useValue: mockEmail },
        { provide: 'CACHE_MANAGER', useValue: mockCache },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
  });

  describe('submitFeedback', () => {
    it('should submit feedback and extract headers', async () => {
      const dto: CreateFeedbackDto = {
        type: FeedbackType.BUG,
        title: 'Crash',
        description: 'App crashes',
      };
      mockRepo.createAndSave.mockResolvedValue({
        id: 'uuid',
        ...dto,
        appVersion: '2.3.1',
        platform: 'android',
        priority: FeedbackPriority.HIGH,
      } as any);

      const result = await service.submitFeedback(dto, mockReq);

      expect(result.appVersion).toBe('2.3.1');
      expect(result.platform).toBe('android');
      expect(mockRepo.createAndSave).toHaveBeenCalled();
      expect(mockEmail.sendBugReportEmail).toHaveBeenCalled(); // high pri bug
    });

    it('should handle missing headers', async () => {
      const dto: CreateFeedbackDto = { type: FeedbackType.FEEDBACK, title: 'Test', description: 'Test' };
      (mockReq.headers as any) = {};

      mockRepo.createAndSave.mockResolvedValue({} as any);
      await service.submitFeedback(dto, mockReq);
      expect(mockRepo.createAndSave.mock.calls[0][0].appVersion).toBe('unknown');
    });
  });

  describe('getFeedbackStats', () => {
    it('should return cached stats', async () => {
      const stats = { total: 42, byType: {} };
      mockCache.get.mockResolvedValue(stats);
      mockRepo.getStats.mockResolvedValue(stats as any);

      const result = await service.getFeedbackStats();
      expect(result).toBe(stats);
      expect(mockRepo.getStats).not.toHaveBeenCalled();
    });

    it('should fetch and cache on miss', async () => {
      mockCache.get.mockResolvedValue(null);
      const stats = { total: 10 };
      mockRepo.getStats.mockResolvedValue(stats as any);
      mockCache.set.mockResolvedValue(undefined);

      await service.getFeedbackStats();
      expect(mockRepo.getStats).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith('feedback:stats', stats, 300);
    });
  });

  // more tests...
  it('updateStatus invalidates cache', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1' } as any);
    mockRepo.update.mockResolvedValue({} as any);

    await service.updateStatus('1', { status: 'RESOLVED' });
    expect(mockCache.del).toHaveBeenCalledWith('feedback:stats');
  });
});
