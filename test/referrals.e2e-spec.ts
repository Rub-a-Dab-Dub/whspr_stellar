import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('ReferralsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let referrerToken: string;
  let referrerCode: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Register 1: Referrer
    const referrerRes = await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'referrer',
        walletAddress: 'GD2...REFERRER',
        email: 'referrer@test.com',
      });
    
    // Auth login logic if needed (usually a JWT is returned on user creation or login)
    // Assuming /auth/login returns a token
    const loginReferrer = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        walletAddress: 'GD2...REFERRER',
        signature: 'valid_signature',
      });
    referrerToken = loginReferrer.body.access_token;

    // Register 2: Referee
    const refereeRes = await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'referee',
        walletAddress: 'GD1...REFEREE',
        email: 'referee@test.com',
      });

    const loginReferee = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        walletAddress: 'GD1...REFEREE',
        signature: 'valid_signature',
      });
    authToken = loginReferee.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/referrals/code (GET) - should generate a code', async () => {
    const res = await request(app.getHttpServer())
      .get('/referrals/code')
      .set('Authorization', `Bearer ${referrerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.code).toHaveLength(8);
    referrerCode = res.body.code;
  });

  it('/referrals/apply (POST) - should apply referrer code', async () => {
    const res = await request(app.getHttpServer())
      .post('/referrals/apply')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ code: referrerCode });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('/referrals (GET) - should return user referrals', async () => {
    const res = await request(app.getHttpServer())
      .get('/referrals')
      .set('Authorization', `Bearer ${referrerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.referrals[0].referralCode).toBe(referrerCode);
  });

  it('/referrals/leaderboard (GET) - should access public leaderboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/referrals/leaderboard');
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
