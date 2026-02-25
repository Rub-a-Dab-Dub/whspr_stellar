import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueHealthService } from './queue-health.service';

export const QUEUE_NAMES = {
  TX_VERIFICATION: 'tx-verification',
  WALLET_CREATION: 'wallet-creation',
  NOTIFICATIONS: 'notifications',
  ANALYTICS: 'analytics',
  ROOM_EXPIRY: 'room-expiry',
} as const;

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 3000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 100 },
};

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.TX_VERIFICATION,
        defaultJobOptions: { ...defaultJobOptions, attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
      },
      {
        name: QUEUE_NAMES.WALLET_CREATION,
        defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
      },
      {
        name: QUEUE_NAMES.NOTIFICATIONS,
        defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
      },
      {
        name: QUEUE_NAMES.ANALYTICS,
        defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
      },
      {
        name: QUEUE_NAMES.ROOM_EXPIRY,
        defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
      },
    ),
  ],
  providers: [QueueHealthService],
  exports: [BullModule, QueueHealthService],
})
export class QueuesModule {}
