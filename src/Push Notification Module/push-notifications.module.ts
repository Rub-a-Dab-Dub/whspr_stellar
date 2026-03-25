import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { PushSubscription } from './entities/push-subscription.entity';
import { PushSubscriptionsRepository } from './repositories/push-subscriptions.repository';
import { PushNotificationService } from './services/push-notification.service';
import { PushNotificationsController } from './controllers/push-notifications.controller';
import { PushNotificationProcessor } from './processors/push-notification.processor';
import { NotificationPayloadBuilder } from './builders/notification-payload.builder';
import { FirebaseAdminProvider } from './firebase/firebase-admin.provider';
import { PUSH_NOTIFICATION_QUEUE } from './queue/push-queue.constants';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PushSubscription]),
    BullModule.registerQueue({
      name: PUSH_NOTIFICATION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    }),
  ],
  controllers: [PushNotificationsController],
  providers: [
    FirebaseAdminProvider,
    PushSubscriptionsRepository,
    NotificationPayloadBuilder,
    PushNotificationService,
    PushNotificationProcessor,
  ],
  exports: [PushNotificationService],
})
export class PushNotificationsModule {}
