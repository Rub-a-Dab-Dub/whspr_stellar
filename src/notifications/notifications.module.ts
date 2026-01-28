import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';

// Entities
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { UserMute } from './entities/user-mute.entity';
import { NotificationBatch } from './entities/notification-batch.entity';

// Services
import { NotificationService } from './services/notification.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { MuteService } from './services/mute.service';
import { MentionDetectionService } from './services/mention-detection.service';
import { PushNotificationService } from './services/push-notification.service';
import { EmailNotificationService } from './services/email-notification.service';
import { MessageNotificationService } from './services/message-notification.service';

// Controllers
import { NotificationController } from './controllers/notification.controller';

// Gateways
import { NotificationGateway } from './gateways/notification.gateway';

// Jobs
import { NotificationCleanupJob } from './jobs/notification-cleanup.job';
import { NotificationBatchJob } from './jobs/notification-batch.job';

// External modules
import { QueueModule } from '../queue/queue.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      UserMute,
      NotificationBatch,
    ]),
    ScheduleModule.forRoot(),
    JwtModule.register({}), // Will use global JWT config
    forwardRef(() => QueueModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [NotificationController],
  providers: [
    // Services
    NotificationService,
    NotificationPreferenceService,
    MuteService,
    MentionDetectionService,
    PushNotificationService,
    EmailNotificationService,
    MessageNotificationService,
    
    // Gateways
    NotificationGateway,
    
    // Jobs
    NotificationCleanupJob,
    NotificationBatchJob,
  ],
  exports: [
    NotificationService,
    NotificationPreferenceService,
    MuteService,
    MentionDetectionService,
    PushNotificationService,
    EmailNotificationService,
    MessageNotificationService,
    NotificationGateway,
  ],
})
export class NotificationsModule {}