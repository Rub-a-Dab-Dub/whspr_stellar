import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { Payment } from './entities/payment.entity';
import { User } from '../user/entities/user.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsGateway } from './payments.gateway';
import { RecipientResolutionService } from './services/recipient-resolution.service';
import { PaymentBlockchainService } from './services/payment-blockchain.service';
import { TxVerificationService } from './services/tx-verification.service';
import { TxVerificationProcessor } from './processors/tx-verification.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User]),
    JwtModule.register({}),
    ConfigModule,
    BullModule.registerQueue({
      name: 'tx-verification',
      defaultJobOptions: {
        attempts: 5,           // Up to 5 retries
        backoff: {
          type: 'exponential', // Exponential backoff
          delay: 5000,         // Starts at 5s, then 25s, 125s, etc.
        },
        removeOnComplete: true,
      },
    }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsGateway,
    RecipientResolutionService,
    PaymentBlockchainService,
    TxVerificationService,
    TxVerificationProcessor,
  ],
  exports: [PaymentsService, TxVerificationService],
})
export class PaymentsModule {}
