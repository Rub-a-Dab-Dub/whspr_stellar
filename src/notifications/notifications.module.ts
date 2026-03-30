import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '../messaging/messaging.module';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { NotificationDigestModule } from '../notification-digest/notification-digest.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    MessagingModule,
    forwardRef(() => NotificationDigestModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService],
  exports: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
