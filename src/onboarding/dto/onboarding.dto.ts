import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { OnboardingStep } from '../entities/onboarding-progress.entity';

export class CompleteStepDto {
  @IsEnum(OnboardingStep)
  @IsNotEmpty()
  step!: OnboardingStep;
}

export class SkipStepDto {
  @IsEnum(OnboardingStep)
  @IsNotEmpty()
  step!: OnboardingStep;
}

export class GetOnboardingProgressDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;
}

export class OnboardingProgressResponseDto {
  id!: string;
  userId!: string;
  currentStep!: OnboardingStep | null;
  completedSteps!: OnboardingStep[];
  skippedSteps!: OnboardingStep[];
  isCompleted!: boolean;
  completedAt!: Date | null;
  startedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  nextStep!: OnboardingStep | null;
  completionPercentage!: number;
}
