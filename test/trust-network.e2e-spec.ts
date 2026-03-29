import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { TrustNetworkModule } from '../src/trust-network/trust-network.module';

describe('TrustNetwork (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/users/:id/vouch POST (201)', () => {
    return request(app.getHttpServer())
      .post('/users/vouched-uuid/vouch')
      .set('Authorization', 'Bearer valid-jwt')
      .send({ trustScore: 4, comment: 'test' })
      .expect(201);
  });

  it('/users/:id/vouch DELETE (200)', () => {
    return request(app.getHttpServer())
      .delete('/users/vouched-uuid/vouch')
      .set('Authorization', 'Bearer valid-jwt')
      .expect(200);
  });

  it('/users/:id/trust GET (200)', () => {
    return request(app.getHttpServer())
      .get('/users/uuid/trust')
      .expect(200)
      .expect(res => {
        expect(res.body).toHaveProperty('score');
        expect(res.body).toHaveProperty('vouchCount');
      });
  });

  it('/users/:id/vouchers GET (200)', () => {
    return request(app.getHttpServer())
      .get('/users/uuid/vouchers')
      .expect(200);
  });

  it('/users/:id/vouched GET (200)', () => {
    return request(app.getHttpServer())
      .get('/users/uuid/vouched')
      .expect(200);
  });

  it('vouch low trust (403)', () => {
    return request(app.getHttpServer())
      .post('/users/uuid/vouch')
      .set('Authorization', 'Bearer low-trust-jwt')
      .send({ trustScore: 5 })
      .expect(403);
  });
});
