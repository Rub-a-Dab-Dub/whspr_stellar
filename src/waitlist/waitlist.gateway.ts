import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/waitlist',
})
export class WaitlistGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WaitlistGateway.name);

  afterInit() {
    this.logger.log('WaitlistGateway initialised');
  }

  emitLeaderboardUpdate(data: any[]): void {
    this.server.emit('leaderboard:update', {
      timestamp: new Date().toISOString(),
      leaderboard: data,
    });
  }
}