import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { BotsController } from '../../src/bots/bots.controller';
import { BotsService } from '../../src/bots/bots.service';

describe('BotsController (e2e)', () => {
  let app: INestApplication;
  let botsService: jest.Mocked<BotsService>;

  beforeAll(async () => {
    botsService = {
      createBot: jest.fn(async (ownerId: string, dto: any) => ({
        id: 'bot-1',
        ownerId,
        name: dto.name,
        username: dto.username,
        avatarUrl: dto.avatarUrl ?? null,
        webhookUrl: dto.webhookUrl,
        scopes: dto.scopes,
        isActive: dto.isActive ?? true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        commands: dto.commands ?? [],
      })),
      getBots: jest.fn(async () => [
        {
          id: 'bot-1',
          ownerId: 'user-1',
          name: 'Helper Bot',
          username: 'helper_bot',
          avatarUrl: null,
          webhookUrl: 'https://example.com/bot-webhook',
          scopes: ['messages:read'],
          isActive: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          commands: [{ command: '/help', description: 'Show help', usage: '/help' }],
        },
      ]),
      updateBot: jest.fn(async (_ownerId: string, botId: string, dto: any) => ({
        id: botId,
        ownerId: 'user-1',
        name: dto.name ?? 'Bot',
        username: dto.username ?? 'bot',
        avatarUrl: dto.avatarUrl ?? null,
        webhookUrl: dto.webhookUrl ?? 'https://example.com',
        scopes: dto.scopes ?? ['messages:read'],
        isActive: dto.isActive ?? true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        commands: dto.commands ?? [],
      })),
      deleteBot: jest.fn(async () => undefined),
      addToGroup: jest.fn(async (_ownerId: string, groupId: string, botId: string) => ({
        groupId,
        botId,
        name: 'Bot',
        username: 'bot',
        avatarUrl: null,
        isBot: true,
      })),
      removeFromGroup: jest.fn(async () => undefined),
    } as unknown as jest.Mocked<BotsService>;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BotsController],
      providers: [{ provide: BotsService, useValue: botsService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { id: 'user-1' };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/bots creates a bot', async () => {
    const response = await request(app.getHttpServer()).post('/api/bots').send({
      name: 'Helper Bot',
      username: 'helper_bot',
      webhookUrl: 'https://example.com/bot-webhook',
      webhookSecret: 'secret',
      scopes: ['messages:read'],
      commands: [{ command: '/help', description: 'Show help', usage: '/help' }],
    });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe('bot-1');
    expect(botsService.createBot).toHaveBeenCalled();
  });

  it('GET /api/bots lists current user bots', async () => {
    const response = await request(app.getHttpServer()).get('/api/bots');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].username).toBe('helper_bot');
    expect(botsService.getBots).toHaveBeenCalledWith('user-1');
  });

  it('PATCH /api/bots/:id updates a bot', async () => {
    const response = await request(app.getHttpServer()).patch('/api/bots/bot-1').send({
      name: 'Updated Bot',
      isActive: false,
    });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Bot');
    expect(response.body.isActive).toBe(false);
    expect(botsService.updateBot).toHaveBeenCalledWith('user-1', 'bot-1', {
      name: 'Updated Bot',
      isActive: false,
    });
  });

  it('DELETE /api/bots/:id deletes a bot', async () => {
    const response = await request(app.getHttpServer()).delete('/api/bots/bot-1');

    expect(response.status).toBe(204);
    expect(botsService.deleteBot).toHaveBeenCalledWith('user-1', 'bot-1');
  });

  it('POST /api/groups/:id/bots and DELETE /api/groups/:id/bots/:botId work', async () => {
    const groupId = '10000000-0000-0000-0000-000000000000';
    const botId = '20000000-0000-4000-8000-000000000000';
    const addResponse = await request(app.getHttpServer())
      .post(`/api/groups/${groupId}/bots`)
      .send({ botId });
    expect(addResponse.status).toBe(201);
    expect(addResponse.body.isBot).toBe(true);

    const removeResponse = await request(app.getHttpServer()).delete(
      `/api/groups/${groupId}/bots/${botId}`,
    );
    expect(removeResponse.status).toBe(204);
    expect(botsService.removeFromGroup).toHaveBeenCalledWith('user-1', groupId, botId);
  });
});
