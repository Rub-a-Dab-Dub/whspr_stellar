import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingEventListener } from './onboarding-event.listener';
import { OnboardingProgress } from './entities/onboarding-progress.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OnboardingProgress]), EventEmitterModule.forRoot()],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingEventListener],
  exports: [OnboardingService],
})
export class OnboardingModule {}
