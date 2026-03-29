import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationDigest } from './entities/notification-digest.entity';
import { QuietHoursConfig } from './entities/quiet-hours-config.entity';
import { NotificationDigestService } from './notification-digest.service';
import { NotificationDigestController } from './notification-digest.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingModule } from '../messaging/messaging.module';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationDigest, QuietHoursConfig, User]),
    forwardRef(() => NotificationsModule),
    MessagingModule,
    MailModule,
  ],
  controllers: [NotificationDigestController],
  providers: [NotificationDigestService],
  exports: [NotificationDigestService],
})
export class NotificationDigestModule {}
