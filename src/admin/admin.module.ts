import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Message } from '../messages/entities/message.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminContentController } from './controllers/admin-content.controller';
import { AdminContentService } from './services/admin-content.service';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminSettingsService } from './services/admin-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Message, SystemSetting]),
  ],
  controllers: [AdminUsersController, AdminContentController, AdminSettingsController],
  providers: [AdminUsersService, AdminContentService, AdminSettingsService],
})
export class AdminModule {}
