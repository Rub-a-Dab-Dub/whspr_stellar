import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MembershipTierModule } from '../membership-tier/membership-tier.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { Subscription } from './entities/subscription.entity';
import { PaymentRecord } from './entities/payment-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, PaymentRecord]),
    ConfigModule,
    MembershipTierModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository],
  exports: [PaymentsService],
})
export class PaymentsModule {}
