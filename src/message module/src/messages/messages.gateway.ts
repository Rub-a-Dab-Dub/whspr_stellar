import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Message } from './message.entity';
import { MessageResponseDto } from './dto/message-response.dto';

@WebSocketGateway({ cors: true })
@Injectable()
export class MessagesGateway {
  @WebSocketServer()
  server!: Server;

  emitNewMessage(message: Message) {
    const payload = MessageResponseDto.fromEntity(message);
    // Broadcast to conversation room (conversationId) for all participants.
    this.server.to(message.conversationId).emit('message.new', payload);
  }
}
