import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { StoriesService } from './stories.service';
import { StoryResponseDto } from './dto/story-response.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class StoriesGateway {
  @WebSocketServer()
  server: Server;

  constructor(private storiesService: StoriesService) {}

  @SubscribeMessage('stories:view')
  async handleView(
    @MessageBody() data: { storyId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Optional: record view from WS
    const userId = client.data.userId; // assume auth middleware sets
    await this.storiesService.viewStory(data.storyId, userId);
    client.emit('stories:view:confirmed', { storyId: data.storyId });
  }

  emitNewStoryToContacts(userId: string, story: StoryResponseDto) {
    // Emit to all sockets of user's contacts
    // Assume rooms like 'user:{userId}' for contacts
    // In production, get contacts and emit to their rooms
    this.server.to(`contacts:${userId}`).emit('story:new', story);
  }
}

