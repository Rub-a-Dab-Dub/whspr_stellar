import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NotificationsModule } from './notifications/notifications.module';
import { IntentGossipModule } from './intent-gossip/intent-gossip.module';
import { DataEncryptionModule } from './security/data-encryption.module';
import { PaymasterModule } from './services/paymaster.module';
import { EventBoostService } from './event-boost/event-boost.service';
import { TokenTransactionsModule } from './token-transactions/token-transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(),
    NotificationsModule,
    IntentGossipModule,

    DataEncryptionModule,
    PaymasterModule,
    TokenTransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, EventBoostService],
})
export class AppModule {}
