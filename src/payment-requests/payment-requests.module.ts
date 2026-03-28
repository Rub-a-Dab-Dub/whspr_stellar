import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentRequestsService } from './payment-requests.service';
import { PaymentRequestsController } from './payment-requests.controller';
import { PaymentRequestRepository } from './payment-requests.repository';
import { PaymentRequest } from './entities/payment-request.entity';
import { UsersModule } from '../users/users.module';
import { ConversationsModule } from '../conversations/conversations.module'; // assume exists
import { NotificationsModule } from '../notifications/notifications.module';
import { InChatTransfersModule } from '../in-chat-transfers/in-chat-transfers.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRequest]),
    ScheduleModule.forRoot(),
    UsersModule,
    NotificationsModule,
    InChatTransfersModule,
    // ConversationsModule if needed
  ],
  controllers: [PaymentRequestsController],
  providers: [PaymentRequestsService, PaymentRequestRepository],
  exports: [PaymentRequestsService],
})
export class PaymentRequestsModule {}
