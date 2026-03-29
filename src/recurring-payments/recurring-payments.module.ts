import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringPayment } from './entities/recurring-payment.entity';
import { RecurringPaymentRun } from './entities/recurring-payment-run.entity';
import { RecurringPaymentsService } from './recurring-payments.service';
import { RecurringPaymentsController } from './recurring-payments.controller';
import { RecurringPaymentsScheduler } from './recurring-payments.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringPayment, RecurringPaymentRun]),
    NotificationsModule,
    CacheModule,
  ],
  controllers: [RecurringPaymentsController],
  providers: [RecurringPaymentsService, RecurringPaymentsScheduler],
  exports: [RecurringPaymentsService],
})
export class RecurringPaymentsModule {}
