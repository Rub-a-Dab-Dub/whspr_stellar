import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { UserSettingsRepository } from './repositories/user-settings.repository';
import { UserSettingsService } from './services/user-settings.service';
import { UserSettingsController } from './controllers/user_settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettings])],
  controllers: [UserSettingsController],
  providers: [UserSettingsRepository, UserSettingsService],
  exports: [UserSettingsService],
})
export class UserSettingsModule {}
