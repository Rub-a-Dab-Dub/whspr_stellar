import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AML (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/admin/aml/dashboard (GET)', () => {
    return request(app.getHttpServer())
      .get('/admin/aml/dashboard')
      .expect(401); // AdminGuard - expected
  });

  it('/admin/aml/flags (GET)', () => {
    return request(app.getHttpServer())
      .get('/admin/aml/flags')
      .expect(401);
  });
});

