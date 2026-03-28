import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingStep } from './entities/onboarding-progress.entity';
import { OnboardingProgressResponseDto } from './dto/onboarding.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('OnboardingController', () => {
  let controller: OnboardingController;
  let service: jest.Mocked<OnboardingService>;

  const mockUserId = 'user-123';
  const mockProgress: OnboardingProgressResponseDto = {
    id: 'progress-123',
    userId: mockUserId,
    currentStep: OnboardingStep.WALLET_CONNECTED,
    completedSteps: [],
    skippedSteps: [],
    isCompleted: false,
    completedAt: null,
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    nextStep: OnboardingStep.PROFILE_COMPLETED,
    completionPercentage: 0,
  };

  const mockRequest = { user: { id: mockUserId } };
  const mockRequestWithoutUser = { user: null };

  beforeEach(async () => {
    const mockOnboardingService = {
      getProgress: jest.fn(),
      completeStep: jest.fn(),
      skipStep: jest.fn(),
      resetOnboarding: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        {
          provide: OnboardingService,
          useValue: mockOnboardingService,
        },
      ],
    }).compile();

    controller = module.get<OnboardingController>(OnboardingController);
    service = module.get(OnboardingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOnboardingProgress', () => {
    it('should return onboarding progress', async () => {
      service.getProgress.mockResolvedValue(mockProgress);

      const result = await controller.getOnboardingProgress(mockRequest);

      expect(service.getProgress).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockProgress);
    });

    it('should throw BadRequestException when user ID is missing', async () => {
      await expect(controller.getOnboardingProgress(mockRequestWithoutUser))
        .rejects.toThrow(BadRequestException);
      expect(service.getProgress).not.toHaveBeenCalled();
    });
  });

  describe('completeStep', () => {
    it('should complete a step successfully', async () => {
      service.completeStep.mockResolvedValue(mockProgress);

      const result = await controller.completeStep(
        OnboardingStep.PROFILE_COMPLETED,
        mockRequest
      );

      expect(service.completeStep).toHaveBeenCalledWith(mockUserId, OnboardingStep.PROFILE_COMPLETED);
      expect(result).toEqual(mockProgress);
    });

    it('should throw BadRequestException for invalid step', async () => {
      await expect(controller.completeStep('invalid-step' as OnboardingStep, mockRequest))
        .rejects.toThrow(BadRequestException);
      expect(service.completeStep).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user ID is missing', async () => {
      await expect(controller.completeStep(OnboardingStep.PROFILE_COMPLETED, mockRequestWithoutUser))
        .rejects.toThrow(BadRequestException);
      expect(service.completeStep).not.toHaveBeenCalled();
    });
  });

  describe('skipStep', () => {
    it('should skip a step successfully', async () => {
      service.skipStep.mockResolvedValue(mockProgress);

      const result = await controller.skipStep(
        OnboardingStep.PROFILE_COMPLETED,
        mockRequest
      );

      expect(service.skipStep).toHaveBeenCalledWith(mockUserId, OnboardingStep.PROFILE_COMPLETED);
      expect(result).toEqual(mockProgress);
    });

    it('should throw BadRequestException for invalid step', async () => {
      await expect(controller.skipStep('invalid-step' as OnboardingStep, mockRequest))
        .rejects.toThrow(BadRequestException);
      expect(service.skipStep).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user ID is missing', async () => {
      await expect(controller.skipStep(OnboardingStep.PROFILE_COMPLETED, mockRequestWithoutUser))
        .rejects.toThrow(BadRequestException);
      expect(service.skipStep).not.toHaveBeenCalled();
    });
  });

  describe('resetOnboarding', () => {
    it('should reset onboarding successfully', async () => {
      service.resetOnboarding.mockResolvedValue(mockProgress);

      const result = await controller.resetOnboarding(mockRequest);

      expect(service.resetOnboarding).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockProgress);
    });

    it('should throw BadRequestException when user ID is missing', async () => {
      await expect(controller.resetOnboarding(mockRequestWithoutUser))
        .rejects.toThrow(BadRequestException);
      expect(service.resetOnboarding).not.toHaveBeenCalled();
    });
  });

  describe('step validation', () => {
    it('should accept all valid onboarding steps', async () => {
      service.completeStep.mockResolvedValue(mockProgress);

      const validSteps = Object.values(OnboardingStep);

      for (const step of validSteps) {
        await expect(controller.completeStep(step, mockRequest)).resolves.not.toThrow();
        expect(service.completeStep).toHaveBeenCalledWith(mockUserId, step);
      }
    });

    it('should reject invalid step names', async () => {
      const invalidSteps = ['invalid', 'wallet_connected_invalid', '', null, undefined];

      for (const step of invalidSteps) {
        await expect(controller.completeStep(step as OnboardingStep, mockRequest))
          .rejects.toThrow(BadRequestException);
      }
    });
  });
});
