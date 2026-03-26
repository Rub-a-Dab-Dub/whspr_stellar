import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { UserSettingsController } from './user-settings.controller';
import { UserSettingsRepository } from './user-settings.repository';
import { UserSettingsService } from './user-settings.service';
import { TwoFactorModule } from '../two-factor/two-factor.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettings]), forwardRef(() => TwoFactorModule)],
  controllers: [UserSettingsController],
  providers: [UserSettingsService, UserSettingsRepository],
  exports: [UserSettingsService, UserSettingsRepository],
})
export class UserSettingsModule {}
