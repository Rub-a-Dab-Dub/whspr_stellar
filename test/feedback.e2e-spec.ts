import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Feedback (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  it('POST /feedback/submit (anonymous)', async () => {
    const dto = {
      type: 'BUG',
      title: 'Test crash',
      description: 'Repro steps... Screenshot uploaded via /attachments/presign',
    };

    const res = await request(app.getHttpServer())
      .post('/feedback/submit')
      .send(dto)
      .set('x-app-version', '2.3.1')
      .set('x-platform', 'ios')
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.type).toBe('BUG');
    expect(res.body.appVersion).toBe('2.3.1');
  });

  it('POST /feedback/submit validation', async () => {
    await request(app.getHttpServer())
      .post('/feedback/submit')
      .send({ type: 'BUG', title: 'a', description: 'short' })
      .expect(400);
  });

  it('GET /feedback/admin/stats (admin)', async () => {
    // assume admin token
    const token = 'admin-jwt';
    const res = await request(app.getHttpServer())
      .get('/feedback/admin/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('total');
    expect(res.body.byType).toEqual(expect.any(Object));
  });

  it('GET /feedback/admin/queue filter (admin)', async () => {
    const res = await request(app.getHttpServer())
      .get('/feedback/admin/queue?type=BUG&status=NEW&limit=10')
      .set('Authorization', `Bearer admin-jwt`)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('PATCH /feedback/admin/:id (admin)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/feedback/admin/test-uuid')
      .set('Authorization', `Bearer admin-jwt`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    expect(res.body.status).toBe('RESOLVED');
  });

  it('GET /feedback/admin/export CSV', async () => {
    const res = await request(app.getHttpServer())
      .get('/feedback/admin/export?status=NEW')
      .set('Authorization', `Bearer admin-jwt`)
      .expect(200)
      .expect('Content-Type', 'text/csv');

    expect(res.text).toContain('ID,Type,Title');
  });

  afterEach(async () => {
    await app.close();
  });
});
