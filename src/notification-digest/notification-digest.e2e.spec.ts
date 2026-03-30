import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('NotificationDigestController (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // In a real e2e test environment, we would seed the DB and get a token.
    // For this test, we assume standard auth bypass or mock token generation.
    // We will simulate the endpoints using a mock user guard or bypass if possible.
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /settings/quiet-hours (Unauthorized)', () => {
    return request(app.getHttpServer())
      .get('/settings/quiet-hours')
      .expect(401);
  });
});
