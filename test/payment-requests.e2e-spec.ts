import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('PaymentRequests (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/payment-requests (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/payment-requests/conversations/conv123')
      .set('x-user-id', 'user1')
      .send({
        payerId: 'user2',
        asset: 'XLM',
        amount: 10.5,
        expiresInHours: 24,
      })
      .expect(201)
      .expect(res => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.status).toBe('PENDING');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
