import { Logger, Inject, forwardRef } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { StoriesService } from './stories.service';
import { StoryResponseDto } from './dto/story-response.dto';

@WebSocketGateway({ namespace: '/stories', cors: { origin: '*' } })
export class StoriesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(StoriesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => StoriesService))
    private readonly storiesService: StoriesService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.user = payload;
      const uid = payload.sub;
      await client.join(this.feedRoom(uid));
      await client.join(this.ownerRoom(uid));

      this.logger.log(`[/stories] connected socket=${client.id} user=${uid}`);
    } catch {
      this.logger.warn(`[/stories] rejected unauthorized socket ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket): void {
    // presence not tracked for stories
  }

  emitNewStoryToContactFeeds(contactUserIds: string[], story: StoryResponseDto): void {
    for (const contactId of contactUserIds) {
      this.server.to(this.feedRoom(contactId)).emit('story:new', story);
    }
  }

  emitStoryViewCount(storyOwnerId: string, storyId: string, viewCount: number): void {
    this.server.to(this.ownerRoom(storyOwnerId)).emit('story:views', { storyId, viewCount });
  }

  @SubscribeMessage('stories:view')
  async handleView(
    @MessageBody() data: { storyId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = client.data?.user as { sub: string } | undefined;
    if (!user?.sub || !data?.storyId) {
      client.emit('error', { message: 'Invalid request' });
      return;
    }
    const result = await this.storiesService.viewStory(data.storyId, user.sub);
    client.emit('stories:view:confirmed', {
      storyId: data.storyId,
      viewCount: result.viewCount,
    });
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    const auth = client.handshake.auth?.token;
    if (typeof auth === 'string') {
      return auth;
    }
    return null;
  }

  private feedRoom(userId: string): string {
    return `story-feed:${userId}`;
  }

  private ownerRoom(userId: string): string {
    return `story-owner:${userId}`;
  }
}
