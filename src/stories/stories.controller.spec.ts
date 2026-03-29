jest.mock('./stories.service', () => ({ StoriesService: class StoriesService {} }));

import { ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { ContentType } from './entities/story.entity';

describe('StoriesController', () => {
  let app: INestApplication;
  const storiesService = {
    createStory: jest.fn(),
    getContactStories: jest.fn(),
    getMyStories: jest.fn(),
    viewStory: jest.fn(),
    deleteStory: jest.fn(),
    getStoryViewers: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [StoriesController],
      providers: [
        { provide: StoriesService, useValue: storiesService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate(context: ExecutionContext) {
              const req = context.switchToHttp().getRequest();
              req.user = { id: 'user-1' };
              return true;
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/stories creates', async () => {
    const body = {
      id: 's1',
      userId: 'user-1',
      username: 'a',
      avatarUrl: null,
      contentType: ContentType.TEXT,
      content: 'x',
      mediaUrl: null,
      backgroundColor: null,
      duration: 1000,
      viewCount: 0,
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    storiesService.createStory.mockResolvedValue(body);

    const res = await request(app.getHttpServer())
      .post('/api/stories')
      .send({ contentType: ContentType.TEXT, content: 'hello' })
      .expect(201);

    expect(res.body.id).toBe('s1');
    expect(storiesService.createStory).toHaveBeenCalledWith('user-1', {
      contentType: ContentType.TEXT,
      content: 'hello',
    });
  });

  it('GET /api/stories returns paginated feed', async () => {
    storiesService.getContactStories.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    await request(app.getHttpServer()).get('/api/stories').expect(200);

    expect(storiesService.getContactStories).toHaveBeenCalledWith('user-1', expect.any(Object));
  });

  it('GET /api/stories/mine', async () => {
    storiesService.getMyStories.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    await request(app.getHttpServer()).get('/api/stories/mine').expect(200);
    expect(storiesService.getMyStories).toHaveBeenCalled();
  });

  it('POST /api/stories/:id/view', async () => {
    storiesService.viewStory.mockResolvedValue({ viewCount: 3 });

    const res = await request(app.getHttpServer())
      .post('/api/stories/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/view')
      .expect(200);

    expect(res.body.viewCount).toBe(3);
  });

  it('DELETE /api/stories/:id', async () => {
    storiesService.deleteStory.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/stories/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
      .expect(204);

    expect(storiesService.deleteStory).toHaveBeenCalledWith(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'user-1',
    );
  });

  it('GET /api/stories/:id/viewers', async () => {
    storiesService.getStoryViewers.mockResolvedValue([
      { viewerId: 'v1', viewedAt: new Date().toISOString() },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/stories/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/viewers')
      .expect(200);

    expect(res.body).toHaveLength(1);
  });
});
