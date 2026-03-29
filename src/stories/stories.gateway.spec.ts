jest.mock('./stories.service', () => ({ StoriesService: class StoriesService {} }));

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StoriesGateway } from './stories.gateway';
import { StoriesService } from './stories.service';
import { ContentType } from './entities/story.entity';

describe('StoriesGateway', () => {
  let gateway: StoriesGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verify'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let storiesService: jest.Mocked<Pick<StoriesService, 'viewStory'>>;

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('secret') };
    storiesService = { viewStory: jest.fn().mockResolvedValue({ viewCount: 2 }) };

    gateway = new StoriesGateway(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      storiesService as unknown as StoriesService,
    );

    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;
  });

  describe('emitNewStoryToContactFeeds', () => {
    it('emits story:new to each contact feed room', () => {
      const story = {
        id: 's1',
        userId: 'u1',
        username: 'a',
        avatarUrl: null,
        contentType: ContentType.TEXT,
        content: 'x',
        mediaUrl: null,
        backgroundColor: null,
        duration: 1000,
        viewCount: 0,
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      gateway.emitNewStoryToContactFeeds(['c1', 'c2'], story as any);

      expect(gateway.server.to).toHaveBeenCalledWith('story-feed:c1');
      expect(gateway.server.to).toHaveBeenCalledWith('story-feed:c2');
      expect(gateway.server.emit).toHaveBeenCalledWith('story:new', story);
    });
  });

  describe('emitStoryViewCount', () => {
    it('emits story:views to owner room', () => {
      gateway.emitStoryViewCount('owner-1', 's1', 9);
      expect(gateway.server.to).toHaveBeenCalledWith('story-owner:owner-1');
      expect(gateway.server.emit).toHaveBeenCalledWith('story:views', {
        storyId: 's1',
        viewCount: 9,
      });
    });
  });

  describe('handleConnection', () => {
    it('joins feed and owner rooms when token valid', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u1' });
      const client: any = {
        handshake: { headers: {}, auth: { token: 'tok' } },
        join: jest.fn().mockResolvedValue(undefined),
        data: {},
        disconnect: jest.fn(),
        emit: jest.fn(),
      };

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('story-feed:u1');
      expect(client.join).toHaveBeenCalledWith('story-owner:u1');
    });

    it('disconnects when token invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('bad');
      });
      const client: any = {
        handshake: { headers: {}, auth: {} },
        join: jest.fn(),
        data: {},
        disconnect: jest.fn(),
        emit: jest.fn(),
      };

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleView', () => {
    it('emits error when storyId missing', async () => {
      const client: any = { emit: jest.fn(), data: { user: { sub: 'u1' } } };
      await gateway.handleView({ storyId: '' }, client);
      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Invalid request' });
    });

    it('records view and confirms', async () => {
      const client: any = { emit: jest.fn(), data: { user: { sub: 'u1' } } };
      await gateway.handleView({ storyId: 's1' }, client);
      expect(storiesService.viewStory).toHaveBeenCalledWith('s1', 'u1');
      expect(client.emit).toHaveBeenCalledWith(
        'stories:view:confirmed',
        expect.objectContaining({ storyId: 's1', viewCount: 2 }),
      );
    });
  });
});
