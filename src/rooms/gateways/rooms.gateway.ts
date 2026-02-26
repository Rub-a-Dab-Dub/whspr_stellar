import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomStatsService } from '../services/room-stats.service';

@WebSocketGateway({ namespace: '/rooms', cors: true })
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private statsService: RoomStatsService) {}

  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, payload: { roomId: string; userId: string }) {
    client.join(payload.roomId);
    this.statsService.addConnection(payload.roomId, payload.userId);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, payload: { roomId: string; userId: string }) {
    client.leave(payload.roomId);
    this.statsService.removeConnection(payload.roomId, payload.userId);
  }

  handleConnection(client: Socket) {
    // Connection established
  }

  handleDisconnect(client: Socket) {
    // Clean up connections if needed
  }

  /**
   * Broadcast room.expired to every WebSocket client currently in this room channel.
   */
  notifyRoomExpired(roomId: string): void {
    this.server.to(roomId).emit('room.expired', {
      roomId,
      expiredAt: new Date().toISOString(),
    });
  }
}
