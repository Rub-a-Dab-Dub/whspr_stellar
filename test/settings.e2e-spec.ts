import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UserSettingsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Register a user to test settings auto-creation and auth
    const registerRes = await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'settings_user',
        walletAddress: 'GD1...SETTINGS',
        email: 'settings@test.com',
      });
    
    // Auth login logic to get token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        walletAddress: 'GD1...SETTINGS',
        signature: 'valid_signature',
      });
    authToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/settings (GET) - should return user settings', async () => {
    const res = await request(app.getHttpServer())
      .get('/settings')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeDefined();
    expect(res.body.notificationPreferences).toBeDefined();
  });

  it('/settings (PATCH) - should update theme and language', async () => {
    const res = await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ theme: 'light', language: 'fr' });
    
    expect(res.status).toBe(200);
    expect(res.body.theme).toBe('light');
    expect(res.body.language).toBe('fr');
  });

  it('/settings/reset (POST) - should reset to defaults', async () => {
    const res = await request(app.getHttpServer())
      .post('/settings/reset')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.theme).toBe('dark'); // Assuming dark is default
    expect(res.body.language).toBe('en'); // Assuming en is default
  });

  it('/settings/2fa/enable (POST) - should initiate 2FA', async () => {
    const res = await request(app.getHttpServer())
      .post('/settings/2fa/enable')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.status).toBe(201);
    expect(res.body.secret).toBeDefined();
  });
});
