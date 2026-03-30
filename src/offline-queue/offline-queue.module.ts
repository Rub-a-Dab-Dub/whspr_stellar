import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import Redis from 'ioredis';
import { OfflineMessageQueue } from './entities/offline-message-queue.entity';
import { OfflineQueueService } from './offline-queue.service';
import { OfflineQueueGateway } from './offline-queue.gateway';
import { OfflineQueueController } from './offline-queue.controller';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([OfflineMessageQueue]),
  ],
  controllers: [OfflineQueueController],
  providers: [
    OfflineQueueService,
    OfflineQueueGateway,
    {
      provide: 'OFFLINE_REDIS_CLIENT',
      useFactory: (config: ConfigService): Redis => {
        return new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_OFFLINE_QUEUE_DB', 1),
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [OfflineQueueService],
})
export class OfflineQueueModule {}
