import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { AUTH_WALLETS } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  truncateAllTables,
} from './setup/create-test-app';
import { AppPlatform } from '../../src/app-version/entities/app-version.entity';

describe('AppVersion (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    process.env.ADMIN_USER_IDS = '';
    await truncateAllTables(dataSource);
  });

  it('publishes versions, exposes changelog info, and warns on soft updates', async () => {
    const adminAuth = await authenticateViaChallenge(app, AUTH_WALLETS.admin);
    process.env.ADMIN_USER_IDS = adminAuth.user.id;

    await request(app.getHttpServer())
      .post('/api/admin/app/versions')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        platform: AppPlatform.WEB,
        version: '2.0.0',
        minSupportedVersion: '1.5.0',
        isSoftUpdate: true,
        releaseNotes: 'Fresh navigation and bug fixes',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/app/version')
      .query({ platform: AppPlatform.WEB })
      .set('X-App-Version', '1.8.0')
      .set('X-App-Platform', AppPlatform.WEB)
      .expect(200);

    expect(response.headers['x-update-available']).toBe('true');
    expect(response.body.latestVersion).toBe('2.0.0');
    expect(response.body.releaseNotes).toBe('Fresh navigation and bug fixes');
    expect(response.body.softUpdate).toBe(true);
  });

  it('blocks outdated clients with 426 when below minimum support', async () => {
    const adminAuth = await authenticateViaChallenge(app, AUTH_WALLETS.admin);
    process.env.ADMIN_USER_IDS = adminAuth.user.id;

    await request(app.getHttpServer())
      .post('/api/admin/app/versions')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        platform: AppPlatform.IOS,
        version: '3.0.0',
        minSupportedVersion: '2.5.0',
        isForceUpdate: true,
        releaseNotes: 'Security release',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/app/version')
      .query({ platform: AppPlatform.IOS })
      .set('X-App-Version', '2.0.0')
      .set('X-App-Platform', AppPlatform.IOS)
      .expect(426);

    expect(response.body.error).toBe('Upgrade Required');
    expect(response.body.version.latestVersion).toBe('3.0.0');
    expect(response.headers['x-min-supported-version']).toBe('2.5.0');
  });
});
