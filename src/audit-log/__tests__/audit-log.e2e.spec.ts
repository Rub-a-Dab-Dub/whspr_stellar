import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AuditLogModule } from '../audit-log.module';
import { AuditLogService } from '../audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditAction } from '../constants/audit-actions';

const mockService = {
  searchLogs: jest.fn(),
  findById: jest.fn(),
  exportLogs: jest.fn(),
  log: jest.fn(),
};

class MockJwtGuard {
  canActivate(ctx: any) {
    ctx.switchToHttp().getRequest().user = { id: 'admin-id' };
    return true;
  }
}

const VALID_UUID = '00000000-0000-0000-0000-000000000001';

describe('AuditLog (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AuditLogModule],
    })
      .overrideProvider(AuditLogService)
      .useValue(mockService)
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());
  afterEach(() => jest.clearAllMocks());

  // ── GET /admin/audit-logs ─────────────────────────────────────────────────

  describe('GET /admin/audit-logs', () => {
    it('returns 200 with paginated results', async () => {
      mockService.searchLogs.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      });

      const res = await request(app.getHttpServer()).get('/admin/audit-logs').expect(200);

      expect(res.body.total).toBe(0);
    });

    it('forwards valid filter params', async () => {
      mockService.searchLogs.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });

      await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .query({ action: AuditAction.AUTH_LOGIN, page: 1, limit: 10 })
        .expect(200);

      expect(mockService.searchLogs).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.AUTH_LOGIN }),
      );
    });

    it('returns 400 for invalid action enum', async () => {
      await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .query({ action: 'NOT_REAL_ACTION' })
        .expect(400);
    });

    it('returns 400 for invalid actorId format', async () => {
      await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .query({ actorId: 'not-a-uuid' })
        .expect(400);
    });
  });

  // ── GET /admin/audit-logs/:id ─────────────────────────────────────────────

  describe('GET /admin/audit-logs/:id', () => {
    it('returns 200 for a known log entry', async () => {
      mockService.findById.mockResolvedValue({
        id: VALID_UUID,
        action: AuditAction.AUTH_LOGIN,
        resource: 'auth',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer())
        .get(`/admin/audit-logs/${VALID_UUID}`)
        .expect(200);

      expect(res.body.id).toBe(VALID_UUID);
    });

    it('returns 400 for non-UUID param', async () => {
      await request(app.getHttpServer()).get('/admin/audit-logs/not-a-uuid').expect(400);
    });
  });

  // ── POST /admin/audit-logs/export ─────────────────────────────────────────

  describe('POST /admin/audit-logs/export', () => {
    it('returns CSV content-type and data', async () => {
      mockService.exportLogs.mockResolvedValue(
        `id,actorId,targetId,action,resource,resourceId,ipAddress,userAgent,metadata,createdAt\n${VALID_UUID},,,AUTH_LOGIN,auth,,,,,2025-01-01T00:00:00.000Z`,
      );

      const res = await request(app.getHttpServer())
        .post('/admin/audit-logs/export')
        .send({})
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.text).toContain('AUTH_LOGIN');
    });

    it('returns 400 for invalid action in export filter', async () => {
      await request(app.getHttpServer())
        .post('/admin/audit-logs/export')
        .send({ action: 'BAD_ACTION' })
        .expect(400);
    });

    it('accepts an empty filter body', async () => {
      mockService.exportLogs.mockResolvedValue(
        'id,actorId,targetId,action,resource,resourceId,ipAddress,userAgent,metadata,createdAt\n',
      );

      await request(app.getHttpServer()).post('/admin/audit-logs/export').send({}).expect(200);
    });
  });
});
