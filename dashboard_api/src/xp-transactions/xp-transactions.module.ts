import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { XPTransaction } from './entities/xp-transaction.entity';
import { XPTransactionController } from './xp-transaction.controller';
import { XPTransactionService } from './xp-transaction.service';
import { XPTransactionRepository } from './repositories/xp-transaction.repository';
import { FraudDetectionListener } from './listeners/fraud-detection.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([XPTransaction]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        ttl: 300,
      }),
    }),
    EventEmitterModule.forRoot(),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get('MAIL_HOST'),
          port: configService.get('MAIL_PORT'),
          auth: {
            user: configService.get('MAIL_USER'),
            pass: configService.get('MAIL_PASSWORD'),
          },
        },
        defaults: {
          from: configService.get('MAIL_FROM'),
        },
      }),
    }),
  ],
  controllers: [XPTransactionController],
  providers: [XPTransactionService, XPTransactionRepository, FraudDetectionListener],
  exports: [XPTransactionService, XPTransactionRepository, FraudDetectionListener],
})
export class XpTransactionsModule {}
