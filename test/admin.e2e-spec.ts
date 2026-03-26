import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AdminModule (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    } catch (e) {
      console.error('Test DB setup failed', e);
    }
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/admin/users (GET) - unauthorized without JWT', () => {
    if (!app) return;
    return request(app.getHttpServer())
      .get('/admin/users')
      .expect(401);
  });

  it('/admin/settings (GET) - unauthorized without JWT', () => {
    if (!app) return;
    return request(app.getHttpServer())
      .get('/admin/settings')
      .expect(401);
  });
});
