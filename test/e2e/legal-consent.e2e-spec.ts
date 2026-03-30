import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { AUTH_WALLETS } from './factories';
import { authenticateViaChallenge, createTestApp, truncateAllTables } from './setup/create-test-app';
import { LegalDocument, LegalDocumentType } from '../../src/legal/entities/legal-document.entity';
import { UserConsent } from '../../src/legal/entities/user-consent.entity';

describe('Legal consent flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(dataSource);
  });

  async function createTermsDoc(version: string, isActive = true): Promise<LegalDocument> {
    const repo = dataSource.getRepository(LegalDocument);
    return repo.save(
      repo.create({
        type: LegalDocumentType.TERMS,
        version,
        effectiveDate: new Date(),
        content: `Terms version ${version}`,
        isActive,
      }),
    );
  }

  it('blocks authenticated users until current Terms are accepted', async () => {
    await createTermsDoc('1.0.0', true);
    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(403);
  });

  it('records immutable consent with version + IP + user agent and unblocks access', async () => {
    const doc = await createTermsDoc('1.0.0', true);
    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);

    await request(app.getHttpServer())
      .post(`/api/legal/${LegalDocumentType.TERMS}/accept`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('x-forwarded-for', '203.0.113.7')
      .set('user-agent', 'jest-e2e')
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const consents = await dataSource.getRepository(UserConsent).find({
      where: { userId: auth.user.id },
    });
    expect(consents).toHaveLength(1);
    expect(consents[0].documentId).toBe(doc.id);
    expect(consents[0].version).toBe('1.0.0');
    expect(consents[0].ipAddress).toBe('203.0.113.7');
    expect(consents[0].userAgent).toBe('jest-e2e');
    expect(consents[0].acceptedAt).toBeInstanceOf(Date);
  });

  it('requires re-acceptance after a new Terms version is published', async () => {
    const repo = dataSource.getRepository(LegalDocument);
    const v1 = await createTermsDoc('1.0.0', true);
    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);

    await request(app.getHttpServer())
      .post(`/api/legal/${LegalDocumentType.TERMS}/accept`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(201);

    await repo.update({ id: v1.id }, { isActive: false });
    await createTermsDoc('2.0.0', true);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(403);
  });
});
