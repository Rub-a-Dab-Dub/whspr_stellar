import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server } from 'socket.io'

@WebSocketGateway({ cors: true })
export class ActivityFeedGateway {
  @WebSocketServer()
  server: Server

  emitToUser(userId: string, payload: any) {
    this.server.to(userId).emit('feed:new', payload)
  }
}