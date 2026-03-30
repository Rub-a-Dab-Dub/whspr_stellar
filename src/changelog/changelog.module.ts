import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Changelog } from './entities/changelog.entity';
import { UserChangelogView } from './entities/user-changelog-view.entity';
import { ChangelogService } from './changelog.service';
import { ChangelogController } from './changelog.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Changelog, UserChangelogView]),
    NotificationsModule,
  ],
  providers: [ChangelogService],
  controllers: [ChangelogController],
  exports: [ChangelogService],
})
export class ChangelogModule {}
