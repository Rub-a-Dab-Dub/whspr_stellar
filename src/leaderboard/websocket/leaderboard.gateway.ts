import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { LeaderboardService } from '../leaderboard.service';
import { GetLeaderboardDto } from '../dto/get-leaderboard.dto';

@WebSocketGateway({ namespace: 'leaderboard' })
export class LeaderboardGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly leaderboardService: LeaderboardService) {}

  async emitLeaderboardUpdate(dto: GetLeaderboardDto) {
    const topUsers = await this.leaderboardService.getTopUsers(dto);
    const room = dto.roomId ? `room-${dto.roomId}` : 'global';
    this.server.to(room).emit('leaderboard-update', topUsers);
  }

  @SubscribeMessage('subscribe-leaderboard')
  handleSubscribe(client: any, payload: { roomId?: string }) {
    const room = payload.roomId ? `room-${payload.roomId}` : 'global';
    client.join(room);
  }
}