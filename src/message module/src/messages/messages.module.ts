import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './messages.repository';
import { MessagesGateway } from './messages.gateway';
import { SorobanService } from './soroban.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository, MessagesGateway, SorobanService],
  exports: [MessagesService],
})
export class MessagesModule {}
