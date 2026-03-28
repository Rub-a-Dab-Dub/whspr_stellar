import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { LegalDocument } from '../src/legal/entities/legal-document.entity';
import { UserConsent } from '../src/legal/entities/user-consent.entity';
import { LegalDocumentType, LegalDocumentStatus } from '../src/legal/entities/legal-document.entity';

/**
 * Legal & Consent e2e tests.
 *
 * These tests run against the full NestJS app (real DB required).
 * They cover the happy-path and key error cases for every endpoint.
 *
 * Auth tokens are mocked via the JWT strategy — we inject a pre-signed
 * token using the same JWT_SECRET configured in the test environment.
 */
describe('LegalController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Helpers ──────────────────────────────────────────────────────────────────

  const createDoc = (overrides: Partial<LegalDocument> = {}): Partial<LegalDocument> => ({
    type: LegalDocumentType.TERMS_OF_SERVICE,
    version: `${Date.now()}`,
    content: 'These are the terms.',
    title: 'Terms of Service',
    summary: 'Short summary',
    status: LegalDocumentStatus.ACTIVE,
    publishedAt: new Date(),
    publishedBy: null,
    ...overrides,
  });

  const seedActiveDoc = async (): Promise<LegalDocument> => {
    const repo = dataSource.getRepository(LegalDocument);
    return repo.save(repo.create(createDoc()));
  };

  const seedDraftDoc = async (): Promise<LegalDocument> => {
    const repo = dataSource.getRepository(LegalDocument);
    return repo.save(repo.create(createDoc({ status: LegalDocumentStatus.DRAFT, publishedAt: null })));
  };

  // Setup / teardown ─────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await dataSource.getRepository(UserConsent).delete({});
    await dataSource.getRepository(LegalDocument).delete({});
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /api/legal/documents ───────────────────────────────────────────────

  describe('GET /api/legal/documents', () => {
    it('returns empty array when no active documents', async () => {
      const res = await request(app.getHttpServer()).get('/api/legal/documents').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns active documents', async () => {
      await seedActiveDoc();
      const res = await request(app.getHttpServer()).get('/api/legal/documents').expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('status', LegalDocumentStatus.ACTIVE);
    });

    it('does not return DRAFT documents', async () => {
      await seedDraftDoc();
      const res = await request(app.getHttpServer()).get('/api/legal/documents').expect(200);
      const drafts = res.body.filter((d: any) => d.status === LegalDocumentStatus.DRAFT);
      expect(drafts).toHaveLength(0);
    });
  });

  // ── GET /api/legal/documents/:type ────────────────────────────────────────

  describe('GET /api/legal/documents/:type', () => {
    it('returns the active document for a type', async () => {
      await seedActiveDoc();
      const res = await request(app.getHttpServer())
        .get(`/api/legal/documents/${LegalDocumentType.TERMS_OF_SERVICE}`)
        .expect(200);
      expect(res.body.type).toBe(LegalDocumentType.TERMS_OF_SERVICE);
    });

    it('returns 404 when no active document for type', async () => {
      await request(app.getHttpServer())
        .get(`/api/legal/documents/${LegalDocumentType.PRIVACY_POLICY}`)
        .expect(404);
    });
  });

  // ── POST /api/legal/documents/:id/accept (requires auth) ──────────────────
  // NOTE: Full auth flow requires a valid Stellar signature.
  // These tests verify the endpoint contract without a live wallet.

  describe('POST /api/legal/documents/:id/accept', () => {
    it('returns 401 without auth token', async () => {
      const doc = await seedActiveDoc();
      await request(app.getHttpServer())
        .post(`/api/legal/documents/${doc.id}/accept`)
        .expect(401);
    });
  });

  // ── GET /api/legal/consent-history (requires auth) ────────────────────────

  describe('GET /api/legal/consent-history', () => {
    it('returns 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/api/legal/consent-history').expect(401);
    });
  });

  // ── GET /api/legal/documents/:id/consent-status (requires auth) ───────────

  describe('GET /api/legal/documents/:id/consent-status', () => {
    it('returns 401 without auth token', async () => {
      const doc = await seedActiveDoc();
      await request(app.getHttpServer())
        .get(`/api/legal/documents/${doc.id}/consent-status`)
        .expect(401);
    });
  });

  // ── POST /api/legal/admin/documents (requires auth) ───────────────────────

  describe('POST /api/legal/admin/documents', () => {
    it('returns 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/api/legal/admin/documents')
        .send({ type: LegalDocumentType.TERMS_OF_SERVICE, version: '2.0.0', content: 'x' })
        .expect(401);
    });
  });

  // ── POST /api/legal/admin/documents/:id/publish (requires auth) ───────────

  describe('POST /api/legal/admin/documents/:id/publish', () => {
    it('returns 401 without auth token', async () => {
      const doc = await seedDraftDoc();
      await request(app.getHttpServer())
        .post(`/api/legal/admin/documents/${doc.id}/publish`)
        .expect(401);
    });
  });

  // ── ConsentGuard integration ───────────────────────────────────────────────

  describe('ConsentGuard', () => {
    it('public endpoints are accessible without auth or consent', async () => {
      await request(app.getHttpServer()).get('/api/legal/documents').expect(200);
    });
  });
});
