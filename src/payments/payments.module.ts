import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Payment } from './entities/payment.entity';
import { User } from '../user/entities/user.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsGateway } from './payments.gateway';
import { RecipientResolutionService } from './services/recipient-resolution.service';
import { PaymentBlockchainService } from './services/payment-blockchain.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User]),
    JwtModule.register({}),
    ConfigModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsGateway,
    RecipientResolutionService,
    PaymentBlockchainService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
