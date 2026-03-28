import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ChatGateway } from '../src/messaging/gateways/chat.gateway';
import { PollsController } from '../src/polls/polls.controller';
import { PollsService } from '../src/polls/polls.service';

describe('PollsController (e2e)', () => {
  let app: INestApplication;
  let service: jest.Mocked<PollsService>;
  let gateway: jest.Mocked<ChatGateway>;

  const pollId = '11111111-1111-1111-1111-111111111111';
  const conversationId = '22222222-2222-2222-2222-222222222222';
  const userId = '33333333-3333-3333-3333-333333333333';
  const pollResponse = {
    id: pollId,
    conversationId,
    createdBy: userId,
    question: 'Best option?',
    options: ['Alpha', 'Beta'],
    allowMultiple: false,
    isAnonymous: false,
    expiresAt: null,
    isClosed: false,
    createdAt: '2026-03-27T09:00:00.000Z',
    totalVoters: 1,
    results: [
      {
        index: 0,
        text: 'Alpha',
        voteCount: 1,
        voters: [{ userId, username: 'owner', displayName: 'Owner' }],
      },
      {
        index: 1,
        text: 'Beta',
        voteCount: 0,
      },
    ],
    currentUserVote: {
      optionIndexes: [0],
      votedAt: '2026-03-27T09:30:00.000Z',
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PollsController],
      providers: [
        {
          provide: PollsService,
          useValue: {
            createPoll: jest.fn().mockResolvedValue(pollResponse),
            getPollsInConversation: jest.fn().mockResolvedValue([pollResponse]),
            getPollResults: jest.fn().mockResolvedValue(pollResponse),
            castVote: jest.fn().mockResolvedValue(pollResponse),
            retractVote: jest.fn().mockResolvedValue(pollResponse),
            closePoll: jest.fn().mockResolvedValue({ ...pollResponse, isClosed: true }),
            getPollRealtimePayload: jest.fn().mockResolvedValue({
              ...pollResponse,
              currentUserVote: undefined,
            }),
          },
        },
        {
          provide: ChatGateway,
          useValue: {
            sendPollUpdated: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { id: userId };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    service = moduleFixture.get(PollsService);
    gateway = moduleFixture.get(ChatGateway);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a poll', async () => {
    await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/polls`)
      .send({
        question: 'Best option?',
        options: ['Alpha', 'Beta'],
        isAnonymous: false,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBe(pollId);
        expect(res.body.options).toEqual(['Alpha', 'Beta']);
      });
  });

  it('validates option count on poll creation', async () => {
    await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/polls`)
      .send({
        question: 'Too short',
        options: ['Only one'],
      })
      .expect(400);
  });

  it('lists polls in a conversation', async () => {
    await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/polls`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(1);
        expect(res.body[0].id).toBe(pollId);
      });
  });

  it('gets a single poll', async () => {
    await request(app.getHttpServer())
      .get(`/api/polls/${pollId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.question).toBe('Best option?');
      });
  });

  it('casts a vote and emits a websocket update', async () => {
    await request(app.getHttpServer())
      .post(`/api/polls/${pollId}/vote`)
      .send({ optionIndexes: [0] })
      .expect(201)
      .expect((res) => {
        expect(res.body.currentUserVote.optionIndexes).toEqual([0]);
      });

    expect(service.castVote).toHaveBeenCalledWith(userId, pollId, { optionIndexes: [0] });
    expect(gateway.sendPollUpdated).toHaveBeenCalled();
  });

  it('retracts a vote and emits a websocket update', async () => {
    await request(app.getHttpServer()).delete(`/api/polls/${pollId}/vote`).expect(200);

    expect(service.retractVote).toHaveBeenCalledWith(userId, pollId);
    expect(gateway.sendPollUpdated).toHaveBeenCalled();
  });

  it('closes a poll', async () => {
    await request(app.getHttpServer())
      .post(`/api/polls/${pollId}/close`)
      .expect(201)
      .expect((res) => {
        expect(res.body.isClosed).toBe(true);
      });
  });
});
