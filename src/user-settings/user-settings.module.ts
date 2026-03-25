import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { UserSettingsController } from './user-settings.controller';
import { UserSettingsRepository } from './user-settings.repository';
import { UserSettingsService } from './user-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettings])],
  controllers: [UserSettingsController],
  providers: [UserSettingsService, UserSettingsRepository],
  exports: [UserSettingsService, UserSettingsRepository],
})
export class UserSettingsModule {}
