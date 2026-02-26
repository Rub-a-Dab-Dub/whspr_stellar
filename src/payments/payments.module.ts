import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { Payment } from './entities/payment.entity';
import { User } from '../user/entities/user.entity';
import { Message } from '../messages/entities/message.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsGateway } from './payments.gateway';
import { RecipientResolutionService } from './services/recipient-resolution.service';
import { PaymentBlockchainService } from './services/payment-blockchain.service';
import { TransactionVerificationService } from './services/transaction-verification.service';
import { TxVerificationService } from './services/tx-verification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User, Message]),
    JwtModule.register({}),
    ConfigModule,
    BullModule.registerQueue({
      name: 'tx-verification',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
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
    TransactionVerificationService,
    TxVerificationService,
  ],
  exports: [PaymentsService, TxVerificationService],
})
export class PaymentsModule { }
