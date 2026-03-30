import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MembershipTierModule } from '../membership-tier/membership-tier.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { Subscription } from './entities/subscription.entity';
import { PaymentRecord } from './entities/payment-record.entity';
import { BulkPayment } from './entities/bulk-payment.entity';
import { BulkPaymentRow } from './entities/bulk-payment-row.entity';
import { BullModule } from '@nestjs/bull';
import { UsersModule } from '../users/users.module';
import { WalletsModule } from '../wallets/wallets.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, PaymentRecord, BulkPayment, BulkPaymentRow]),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'bulk-payments',
    }),
    ConfigModule,
    MembershipTierModule,
    UsersModule,
    WalletsModule,
    MailModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService, 
    PaymentsRepository,
    BulkPaymentsRepository,
    BulkPaymentService,
    BulkPaymentStorageService,
    BulkPaymentProcessor,
    GoldBlackTierGuard,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
