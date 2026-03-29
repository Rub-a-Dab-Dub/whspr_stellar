import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AIModerationModule } from '../ai-moderation/ai-moderation.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AnalyticsModule,
    AIModerationModule,
    forwardRef(() => UserSettingsModule),
    forwardRef(() => OnboardingModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
