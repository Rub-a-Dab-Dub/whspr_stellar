import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { User } from './entities/user.entity';
import { AIModerationModule } from '../ai-moderation/ai-moderation.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AIModerationModule],
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), 
    forwardRef(() => UserSettingsModule),
    forwardRef(() => OnboardingModule)
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
