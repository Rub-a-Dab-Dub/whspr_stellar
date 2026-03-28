import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForwardedMessage } from './entities/forwarded-message.entity';
import { MessageForwardingController } from './controllers/message-forwarding.controller';
import { MessageForwardingService } from './services/message-forwarding.service';
import { MessageForwardingRepository } from './repositories/message-forwarding.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ForwardedMessage])],
  controllers: [MessageForwardingController],
  providers: [MessageForwardingService, MessageForwardingRepository],
  exports: [MessageForwardingService],
})
export class MessageForwardingModule {}
