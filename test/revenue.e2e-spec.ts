import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Revenue (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/admin/revenue (GET)', () => {
    return request(app.getHttpServer())
      .get('/admin/revenue')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('bySource');
        expect(res.body).toHaveProperty('totalCollectedUsd');
      });
  });
});

