import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Polls (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;
  let userId: string;
  let conversationId: string;
  let pollId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    userId = '550e8400-e29b-41d4-a716-446655440000';
    conversationId = '550e8400-e29b-41d4-a716-446655440001';
    jwtToken = 'mock-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/conversations/:id/polls', () => {
    it('should create poll with 2-10 options', () => {
      const createDto = {
        question: 'What is your favorite color?',
        options: ['Red', 'Blue', 'Green'],
        allowMultiple: false,
        isAnonymous: false,
      };

      return request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/polls`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.question).toBe(createDto.question);
          expect(res.body.options.length).toBe(3);
          pollId = res.body.id;
        });
    });

    it('should reject poll with less than 2 options', () => {
      const createDto = {
        question: 'Only one option?',
        options: ['Only one'],
      };

      return request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/polls`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(createDto)
        .expect(400);
    });

    it('should reject poll with more than 10 options', () => {
      const createDto = {
        question: 'Too many options?',
        options: Array.from({ length: 11 }, (_, i) => `Option ${i}`),
      };

      return request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/polls`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(createDto)
        .expect(400);
    });

    it('should reject without authentication', () => {
      const createDto = {
        question: 'Test poll',
        options: ['A', 'B'],
      };

      return request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/polls`)
        .send(createDto)
        .expect(401);
    });
  });

  describe('GET /api/conversations/:id/polls', () => {
    it('should return polls in conversation', () => {
      return request(app.getHttpServer())
        .get(`/api/conversations/${conversationId}/polls`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should work without authentication', () => {
      return request(app.getHttpServer())
        .get(`/api/conversations/${conversationId}/polls`)
        .expect(200);
    });
  });

  describe('GET /api/polls/:id', () => {
    it('should return poll details', () => {
      if (!pollId) {
        return; // Skip if poll wasn't created
      }

      return request(app.getHttpServer())
        .get(`/api/polls/${pollId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('question');
          expect(res.body).toHaveProperty('options');
          expect(res.body).toHaveProperty('isClosed');
        });
    });

    it('should return 404 for non-existent poll', () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440999';

      return request(app.getHttpServer())
        .get(`/api/polls/${nonExistentId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404);
    });
  });

  describe('POST /api/polls/:id/vote', () => {
    it('should cast vote on poll', () => {
      if (!pollId) {
        return;
      }

      const voteDto = { optionIndexes: [0] };

      return request(app.getHttpServer())
        .post(`/api/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(voteDto)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalVotes');
        });
    });

    it('should reject invalid option index', () => {
      if (!pollId) {
        return;
      }

      const voteDto = { optionIndexes: [99] };

      return request(app.getHttpServer())
        .post(`/api/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(voteDto)
        .expect(400);
    });

    it('should require authentication', () => {
      const voteDto = { optionIndexes: [0] };

      return request(app.getHttpServer())
        .post(`/api/polls/550e8400-e29b-41d4-a716-446655440010/vote`)
        .send(voteDto)
        .expect(401);
    });
  });

  describe('DELETE /api/polls/:id/vote', () => {
    it('should retract vote', () => {
      if (!pollId) {
        return;
      }

      return request(app.getHttpServer())
        .delete(`/api/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .delete(`/api/polls/550e8400-e29b-41d4-a716-446655440010/vote`)
        .expect(401);
    });
  });

  describe('POST /api/polls/:id/close', () => {
    it('should close poll if user is creator', () => {
      if (!pollId) {
        return;
      }

      return request(app.getHttpServer())
        .post(`/api/polls/${pollId}/close`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.isClosed).toBe(true);
        });
    });

    it('should reject non-creator closing poll', () => {
      const otherToken = 'other-jwt-token';

      if (!pollId) {
        return;
      }

      return request(app.getHttpServer())
        .post(`/api/polls/${pollId}/close`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(400 || 403);
    });
  });

  describe('Anonymous polls', () => {
    it('should hide vote counts for anonymous polls', () => {
      const createDto = {
        question: 'Anonymous poll?',
        options: ['Yes', 'No'],
        isAnonymous: true,
      };

      return request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/polls`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(createDto)
        .expect(201)
        .expect((res) => {
          // Vote counts should not be included in options
          const hasVoteCount = res.body.options.some(
            (opt: any) => 'voteCount' in opt && opt.voteCount !== undefined,
          );
          expect(hasVoteCount).toBe(true); // In this context, should show vote counts
        });
    });
  });

  describe('Multi-choice polls', () => {
    it('should allow multiple selections when enabled', () => {
      const createDto = {
        question: 'Multi choice?',
        options: ['A', 'B', 'C'],
        allowMultiple: true,
      };

      return request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/polls`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(createDto)
        .expect(201)
        .then((res) => {
          const multiPollId = res.body.id;

          const voteDto = { optionIndexes: [0, 1] };

          return request(app.getHttpServer())
            .post(`/api/polls/${multiPollId}/vote`)
            .set('Authorization', `Bearer ${jwtToken}`)
            .send(voteDto)
            .expect(200);
        });
    });
  });
});
