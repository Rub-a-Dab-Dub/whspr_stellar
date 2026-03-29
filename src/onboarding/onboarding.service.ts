import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnboardingProgress, OnboardingStep } from './entities/onboarding-progress.entity';
import { OnboardingProgressResponseDto } from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(OnboardingProgress)
    private readonly onboardingRepository: Repository<OnboardingProgress>,
  ) {}

  async getProgress(userId: string): Promise<OnboardingProgressResponseDto> {
    let progress = await this.onboardingRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!progress) {
      progress = await this.createOnboardingProgress(userId);
    }

    return this.mapToResponseDto(progress);
  }

  async createOnboardingProgress(userId: string): Promise<OnboardingProgress> {
    const existingProgress = await this.onboardingRepository.findOne({
      where: { userId },
    });

    if (existingProgress) {
      return existingProgress;
    }

    const progress = this.onboardingRepository.create({
      userId,
      currentStep: OnboardingStep.WALLET_CONNECTED,
      completedSteps: [],
      skippedSteps: [],
      isCompleted: false,
      startedAt: new Date(),
    });

    return await this.onboardingRepository.save(progress);
  }

  async completeStep(userId: string, step: OnboardingStep): Promise<OnboardingProgressResponseDto> {
    const progress = await this.getOrCreateProgress(userId);

    if (progress.completedSteps.includes(step)) {
      this.logger.log(`Step ${step} already completed for user ${userId}`);
      return this.mapToResponseDto(progress);
    }

    if (progress.skippedSteps.includes(step)) {
      progress.skippedSteps = progress.skippedSteps.filter(s => s !== step);
    }

    progress.completedSteps.push(step);
    progress.completedSteps = [...new Set(progress.completedSteps)];

    progress.currentStep = this.getNextStep(progress);

    if (this.checkOnboardingComplete(progress)) {
      progress.isCompleted = true;
      progress.completedAt = new Date();
      this.logger.log(`Onboarding completed for user ${userId}`);
      await this.triggerOnboardingCompletionReward(userId);
    }

    await this.onboardingRepository.save(progress);
    return this.mapToResponseDto(progress);
  }

  async skipStep(userId: string, step: OnboardingStep): Promise<OnboardingProgressResponseDto> {
    const progress = await this.getOrCreateProgress(userId);

    if (progress.completedSteps.includes(step)) {
      this.logger.log(`Cannot skip completed step ${step} for user ${userId}`);
      return this.mapToResponseDto(progress);
    }

    if (!progress.skippedSteps.includes(step)) {
      progress.skippedSteps.push(step);
      progress.skippedSteps = [...new Set(progress.skippedSteps)];
    }

    progress.currentStep = this.getNextStep(progress);

    await this.onboardingRepository.save(progress);
    return this.mapToResponseDto(progress);
  }

  async resetOnboarding(userId: string): Promise<OnboardingProgressResponseDto> {
    const progress = await this.getOrCreateProgress(userId);

    progress.currentStep = OnboardingStep.WALLET_CONNECTED;
    progress.completedSteps = [];
    progress.skippedSteps = [];
    progress.isCompleted = false;
    progress.completedAt = null;
    progress.startedAt = new Date();

    await this.onboardingRepository.save(progress);
    return this.mapToResponseDto(progress);
  }

  async isOnboardingComplete(userId: string): Promise<boolean> {
    const progress = await this.onboardingRepository.findOne({
      where: { userId },
    });

    if (!progress) {
      return false;
    }

    return this.checkOnboardingComplete(progress);
  }

  async getNextStepForUser(userId: string): Promise<OnboardingStep | null> {
    const progress = await this.getOrCreateProgress(userId);
    return this.getNextStep(progress);
  }

  private async getOrCreateProgress(userId: string): Promise<OnboardingProgress> {
    let progress = await this.onboardingRepository.findOne({
      where: { userId },
    });

    if (!progress) {
      progress = await this.createOnboardingProgress(userId);
    }

    return progress;
  }

  private checkOnboardingComplete(progress: OnboardingProgress): boolean {
    const allSteps = Object.values(OnboardingStep) as OnboardingStep[];
    const requiredSteps = allSteps.filter(step => step !== OnboardingStep.WALLET_CONNECTED);
    const completedOrSkipped = [...progress.completedSteps, ...progress.skippedSteps];

    return requiredSteps.every(step => completedOrSkipped.includes(step));
  }

  private getNextStep(progress: OnboardingProgress): OnboardingStep | null {
    const allSteps = Object.values(OnboardingStep) as OnboardingStep[];
    const completedOrSkipped = [...progress.completedSteps, ...progress.skippedSteps];

    const nextStep = allSteps.find(step => !completedOrSkipped.includes(step));

    return nextStep ?? null;
  }

  private mapToResponseDto(progress: OnboardingProgress): OnboardingProgressResponseDto {
    const completionPercentage = this.calculateCompletionPercentage(progress);
    const nextStep = this.getNextStep(progress);

    return {
      id: progress.id,
      userId: progress.userId,
      currentStep: progress.currentStep as OnboardingStep | null,
      completedSteps: progress.completedSteps as OnboardingStep[],
      skippedSteps: progress.skippedSteps as OnboardingStep[],
      isCompleted: progress.isCompleted,
      completedAt: progress.completedAt,
      startedAt: progress.startedAt,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
      nextStep,
      completionPercentage,
    };
  }

  private calculateCompletionPercentage(progress: OnboardingProgress): number {
    const allSteps = Object.values(OnboardingStep);
    const totalSteps = allSteps.length;
    const completedOrSkipped = [...progress.completedSteps, ...progress.skippedSteps];
    
    return Math.round((completedOrSkipped.length / totalSteps) * 100);
  }

  private async triggerOnboardingCompletionReward(userId: string): Promise<void> {
    this.logger.log(`Triggering onboarding completion reward for user ${userId}`);
    
    // TODO: Implement reward system integration
    // This could involve:
    // - Awarding bonus points
    // - Granting a special badge
    // - Sending notification
    // - Updating user stats
    
    // For now, we'll just log the event
    // In a real implementation, this would integrate with the badges/rewards system
  }
}
