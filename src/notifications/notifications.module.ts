import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';

// Entities
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { User } from '../user/entities/user.entity';

// Services
import { NotificationService } from './services/notification.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { PushNotificationService } from './services/push-notification.service';
import { EmailNotificationService } from './services/email-notification.service';
import { MentionDetectionService } from './services/mention-detection.service';
import { NotificationIntegrationService } from './services/notification-integration.service';

// Controllers
import { NotificationController } from './controllers/notification.controller';

// Gateways
import { NotificationGateway } from './gateways/notification.gateway';

// Jobs
import { NotificationCleanupJob } from './jobs/notification-cleanup.job';
import { NotificationBatchingJob } from './jobs/notification-batching.job';

// External modules
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      PushSubscription,
      User,
    ]),
    ScheduleModule.forRoot(),
    JwtModule.register({}), // Will use global JWT config
    forwardRef(() => QueueModule),
    forwardRef(() => AuthModule),
  ],
  providers: [
    // Services
    NotificationService,
    NotificationPreferenceService,
    PushNotificationService,
    EmailNotificationService,
    MentionDetectionService,
    NotificationIntegrationService,
    
    // Gateways
    NotificationGateway,
    
    // Jobs
    NotificationCleanupJob,
    NotificationBatchingJob,
  ],
  controllers: [NotificationController],
  exports: [
    NotificationService,
    NotificationPreferenceService,
    PushNotificationService,
    EmailNotificationService,
    MentionDetectionService,
    NotificationIntegrationService,
    NotificationGateway,
  ],
})
export class NotificationsModule {}