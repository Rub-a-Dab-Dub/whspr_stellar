import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import { CompleteStepDto, SkipStepDto, OnboardingProgressResponseDto } from './dto/onboarding.dto';
import { OnboardingStep } from './entities/onboarding-progress.entity';
import type { Request as ExpressRequest } from 'express';

type JwtRequest = ExpressRequest & { user?: { id: string } };

type AuthedRequest = { user?: { id: string } };

@ApiTags('onboarding')
@Controller('onboarding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'Get user onboarding progress' })
  @ApiResponse({ status: 200, description: 'Onboarding progress retrieved successfully', type: OnboardingProgressResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getOnboardingProgress(@Request() req: AuthedRequest): Promise<OnboardingProgressResponseDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    return await this.onboardingService.getProgress(userId);
  }

  @Post('steps/:step/complete')
  @ApiOperation({ summary: 'Complete an onboarding step' })
  @ApiResponse({ status: 200, description: 'Step completed successfully', type: OnboardingProgressResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid step or already completed' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async completeStep(
    @Param('step') step: OnboardingStep,
    @Request() req: AuthedRequest,
  ): Promise<OnboardingProgressResponseDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    if (!Object.values(OnboardingStep).includes(step)) {
      throw new BadRequestException(`Invalid onboarding step: ${step}`);
    }

    return await this.onboardingService.completeStep(userId, step);
  }

  @Post('steps/:step/skip')
  @ApiOperation({ summary: 'Skip an onboarding step' })
  @ApiResponse({ status: 200, description: 'Step skipped successfully', type: OnboardingProgressResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid step or cannot skip completed step' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async skipStep(
    @Param('step') step: OnboardingStep,
    @Request() req: AuthedRequest,
  ): Promise<OnboardingProgressResponseDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    if (!Object.values(OnboardingStep).includes(step)) {
      throw new BadRequestException(`Invalid onboarding step: ${step}`);
    }

    return await this.onboardingService.skipStep(userId, step);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset onboarding progress' })
  @ApiResponse({ status: 200, description: 'Onboarding reset successfully', type: OnboardingProgressResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetOnboarding(@Request() req: AuthedRequest): Promise<OnboardingProgressResponseDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    return await this.onboardingService.resetOnboarding(userId);
  }
}
