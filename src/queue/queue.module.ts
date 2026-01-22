import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { WalletCreationProcessor } from './processors/wallet-creation.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { BlockchainTaskProcessor } from './processors/blockchain-task.processor';
import { QUEUE_NAMES } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        return {
          redis: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: true,
            removeOnFail: false,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.WALLET_CREATION },
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.BLOCKCHAIN_TASKS },
    ),
  ],
  providers: [
    QueueService,
    WalletCreationProcessor,
    NotificationProcessor,
    BlockchainTaskProcessor,
  ],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
