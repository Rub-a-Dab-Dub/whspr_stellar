import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnboardingService } from './onboarding.service';
import { OnboardingProgress, OnboardingStep } from './entities/onboarding-progress.entity';
import { Logger } from '@nestjs/common';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let repository: jest.Mocked<Repository<OnboardingProgress>>;

  const mockUserId = 'user-123';

  const freshProgress = (overrides: Partial<OnboardingProgress> = {}): OnboardingProgress => ({
    userId: mockUserId,
    currentStep: OnboardingStep.WALLET_CONNECTED,
    completedSteps: [],
    skippedSteps: [],
    isCompleted: false,
    completedAt: null,
    startedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockProgress = freshProgress();

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        {
          provide: getRepositoryToken(OnboardingProgress),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    repository = module.get(getRepositoryToken(OnboardingProgress));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProgress', () => {
    it('should return existing progress', async () => {
      repository.findOne.mockResolvedValue(mockProgress);
      repository.save.mockResolvedValue(mockProgress);

      const result = await service.getProgress(mockUserId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(result).toEqual(
        expect.objectContaining({
          userId: mockUserId,
          currentStep: OnboardingStep.WALLET_CONNECTED,
          completedSteps: [],
          skippedSteps: [],
          isCompleted: false,
          completionPercentage: 0,
          nextStep: OnboardingStep.WALLET_CONNECTED,
        }),
      );
    });

    it('should create new progress if none exists', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockProgress);
      repository.save.mockResolvedValue(mockProgress);

      const result = await service.getProgress(mockUserId);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          currentStep: OnboardingStep.WALLET_CONNECTED,
          completedSteps: [],
          skippedSteps: [],
          isCompleted: false,
          startedAt: expect.any(Date),
        })
      );
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('completeStep', () => {
    beforeEach(() => {
      const p = freshProgress();
      repository.findOne.mockResolvedValue(p);
      repository.save.mockImplementation(async (x) => x as OnboardingProgress);
    });

    it('should complete a step successfully', async () => {
      const result = await service.completeStep(mockUserId, OnboardingStep.PROFILE_COMPLETED);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          completedSteps: [OnboardingStep.PROFILE_COMPLETED],
          currentStep: expect.any(String),
        })
      );
      expect(result.completedSteps).toContain(OnboardingStep.PROFILE_COMPLETED);
    });

    it('should not duplicate completed steps', async () => {
      const progressWithCompletedStep = freshProgress({
        completedSteps: [OnboardingStep.PROFILE_COMPLETED],
      });
      repository.findOne.mockResolvedValue(progressWithCompletedStep);

      await service.completeStep(mockUserId, OnboardingStep.PROFILE_COMPLETED);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should remove step from skipped when completing', async () => {
      const progressWithSkippedStep = freshProgress({
        skippedSteps: [OnboardingStep.PROFILE_COMPLETED],
      });
      repository.findOne.mockResolvedValue(progressWithSkippedStep);

      await service.completeStep(mockUserId, OnboardingStep.PROFILE_COMPLETED);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          skippedSteps: [],
          completedSteps: [OnboardingStep.PROFILE_COMPLETED],
        })
      );
    });

    it('should mark onboarding as complete when all steps are done', async () => {
      const allStepsExceptLast = Object.values(OnboardingStep).filter(
        step => step !== OnboardingStep.FIRST_TRANSFER
      );
      const almostCompleteProgress = freshProgress({
        completedSteps: allStepsExceptLast,
      });
      repository.findOne.mockResolvedValue(almostCompleteProgress);

      await service.completeStep(mockUserId, OnboardingStep.FIRST_TRANSFER);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isCompleted: true,
          completedAt: expect.any(Date),
        })
      );
    });
  });

  describe('skipStep', () => {
    beforeEach(() => {
      const p = freshProgress();
      repository.findOne.mockResolvedValue(p);
      repository.save.mockImplementation(async (x) => x as OnboardingProgress);
    });

    it('should skip a step successfully', async () => {
      const result = await service.skipStep(mockUserId, OnboardingStep.PROFILE_COMPLETED);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          skippedSteps: [OnboardingStep.PROFILE_COMPLETED],
        })
      );
      expect(result.skippedSteps).toContain(OnboardingStep.PROFILE_COMPLETED);
    });

    it('should not skip already completed steps', async () => {
      const progressWithCompletedStep = freshProgress({
        completedSteps: [OnboardingStep.PROFILE_COMPLETED],
      });
      repository.findOne.mockResolvedValue(progressWithCompletedStep);

      await service.skipStep(mockUserId, OnboardingStep.PROFILE_COMPLETED);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('resetOnboarding', () => {
    beforeEach(() => {
      repository.findOne.mockResolvedValue(freshProgress());
      repository.save.mockImplementation(async (x) => x as OnboardingProgress);
    });

    it('should reset all progress', async () => {
      const result = await service.resetOnboarding(mockUserId);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: OnboardingStep.WALLET_CONNECTED,
          completedSteps: [],
          skippedSteps: [],
          isCompleted: false,
          completedAt: null,
          startedAt: expect.any(Date),
        })
      );
    });
  });

  describe('isOnboardingComplete', () => {
    it('should return false for non-existent progress', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.isOnboardingComplete(mockUserId);

      expect(result).toBe(false);
    });

    it('should return false for incomplete progress', async () => {
      repository.findOne.mockResolvedValue(mockProgress);

      const result = await service.isOnboardingComplete(mockUserId);

      expect(result).toBe(false);
    });

    it('should return true for complete progress', async () => {
      const completeProgress = {
        ...mockProgress,
        completedSteps: Object.values(OnboardingStep),
        isCompleted: true,
      };
      repository.findOne.mockResolvedValue(completeProgress);

      const result = await service.isOnboardingComplete(mockUserId);

      expect(result).toBe(true);
    });
  });

  describe('getNextStepForUser', () => {
    it('should return next step for incomplete progress', async () => {
      repository.findOne.mockResolvedValue(mockProgress);

      const result = await service.getNextStepForUser(mockUserId);

      expect(result).toBe(OnboardingStep.WALLET_CONNECTED);
    });

    it('should return null for complete progress', async () => {
      const completeProgress = {
        ...mockProgress,
        completedSteps: Object.values(OnboardingStep),
      };
      repository.findOne.mockResolvedValue(completeProgress);

      const result = await service.getNextStepForUser(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('createOnboardingProgress', () => {
    it('should create new progress', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockProgress);
      repository.save.mockResolvedValue(mockProgress);

      const result = await service.createOnboardingProgress(mockUserId);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          currentStep: OnboardingStep.WALLET_CONNECTED,
          completedSteps: [],
          skippedSteps: [],
          isCompleted: false,
          startedAt: expect.any(Date),
        })
      );
      expect(result).toBe(mockProgress);
    });

    it('should return existing progress', async () => {
      repository.findOne.mockResolvedValue(mockProgress);

      const result = await service.createOnboardingProgress(mockUserId);

      expect(repository.create).not.toHaveBeenCalled();
      expect(result).toBe(mockProgress);
    });
  });
});
