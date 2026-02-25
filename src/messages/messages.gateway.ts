import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/messages',
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // Client connected
  }

  handleDisconnect(client: Socket) {
    // Client disconnected
  }

  emitMessageEdited(
    roomId: string,
    messageId: string,
    newContent: string,
    editedAt: Date,
  ) {
    this.server.to(`room_${roomId}`).emit('message.edited', {
      messageId,
      content: newContent,
      editedAt,
      roomId,
    });
  }

  emitMessageDeleted(roomId: string, messageId: string) {
    this.server.to(`room_${roomId}`).emit('message.deleted', {
      messageId,
      roomId,
    });
  }

  // Example method to join a room, if clients need to join rooms
  joinRoom(client: Socket, roomId: string) {
    client.join(`room_${roomId}`);
  }
}
