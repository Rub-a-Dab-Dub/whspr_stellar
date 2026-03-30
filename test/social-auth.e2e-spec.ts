import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('SocialAuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/auth/social/google (GET) redirects to Google', () => {
    return request(app.getHttpServer())
      .get('/auth/social/google')
      .expect(302); // Redirects to Google
  });

  it('/auth/social/github (GET) redirects to GitHub', () => {
    return request(app.getHttpServer())
      .get('/auth/social/github')
      .expect(302); // Redirects to GitHub
  });

  it('/auth/social/twitter (GET) redirects to Twitter', () => {
    return request(app.getHttpServer())
      .get('/auth/social/twitter')
      .expect(302); // Redirects to Twitter
  });
});
