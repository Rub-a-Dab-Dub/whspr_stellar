import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { generateKeyPairSync, sign } from 'crypto';
import { AUTH_WALLETS } from './factories';
import { authenticateViaChallenge, createTestApp, truncateAllTables } from './setup/create-test-app';
import { canonicalCredentialPayload } from '../../src/did/utils/vc-crypto.util';

describe('DID & verifiable credentials (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await truncateAllTables(dataSource);
  });

  it('registers did:stellar, issues signed credential, resolves DID, verifies, revokes', async () => {
    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);

    const stellarReg = await request(app.getHttpServer())
      .post('/api/did/register')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        method: 'stellar',
        stellarPublicKey: AUTH_WALLETS.primary,
        stellarNetwork: 'testnet',
      })
      .expect(201);

    expect(stellarReg.body.did).toContain('did:stellar:testnet:');
    expect(stellarReg.body.did).toContain(AUTH_WALLETS.primary);

    const resolved = await request(app.getHttpServer())
      .get('/api/did/resolve')
      .query({ did: stellarReg.body.did })
      .expect(200);

    expect(resolved.body.id).toBe(stellarReg.body.did);

    const issuerReg = await request(app.getHttpServer())
      .post('/api/did/register')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ method: 'key' })
      .expect(201);

    const issuerDid = issuerReg.body.did as string;
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string };

    await request(app.getHttpServer())
      .patch('/api/did/document')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        did: issuerDid,
        didDocument: {
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: issuerDid,
          ed25519PublicKeyJwkX: jwk.x,
        },
      })
      .expect(200);

    const issuedAt = new Date().toISOString();
    const credCore = {
      credentialType: 'GaslessGossipProfileCredential',
      issuer: issuerDid,
      credentialSubject: { id: 'did:subject:test', name: 'E2E' },
      issuedAt,
    };
    const sig = sign(
      null,
      Buffer.from(canonicalCredentialPayload({ ...credCore, proof: {} }), 'utf8'),
      privateKey,
    ).toString('base64');

    const vcRes = await request(app.getHttpServer())
      .post('/api/did/credentials')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        didId: stellarReg.body.id,
        ...credCore,
        proof: { type: 'Ed25519Signature2020', proofValue: sig },
        showOnProfile: true,
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/did/credentials')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThanOrEqual(1);

    const verifyOk = await request(app.getHttpServer())
      .post('/api/did/credentials/verify')
      .send({ credentialId: vcRes.body.id })
      .expect(200);

    expect(verifyOk.body.valid).toBe(true);

    const pub = await request(app.getHttpServer())
      .get(`/api/did/public/${auth.user.id}`)
      .expect(200);

    expect(pub.body.some((c: { id: string }) => c.id === vcRes.body.id)).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/did/credentials/${vcRes.body.id}/revoke`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(201);

    const verifyRevoked = await request(app.getHttpServer())
      .post('/api/did/credentials/verify')
      .send({ credentialId: vcRes.body.id })
      .expect(200);

    expect(verifyRevoked.body.valid).toBe(false);
    expect(verifyRevoked.body.reasons).toContain('revoked');

    await request(app.getHttpServer())
      .delete(`/api/did/credentials/${vcRes.body.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(204);
  });
});
