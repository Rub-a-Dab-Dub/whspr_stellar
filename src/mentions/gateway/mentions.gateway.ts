import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Mention } from '../entities/mention.entity';

@WebSocketGateway({ cors: true })
export class MentionsGateway {
  @WebSocketServer()
  server: Server;

  emitMentionNew(userId: string, mention: Mention): void {
    this.server.to(userId).emit('mention:new', mention);
  }
}
