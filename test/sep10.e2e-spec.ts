import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Sep10Module } from '../src/sep10/sep10.module';
import { Sep10Service } from '../src/sep10/sep10.service';

describe('SEP-10 E2E', () => {
  let app: INestApplication;
  let sep10Service: Sep10Service;
  let serverKeypair: StellarSdk.Keypair;
  let clientKeypair: StellarSdk.Keypair;
  const networkPassphrase = StellarSdk.Networks.TESTNET;
  const homeDomain = 'localhost';

  beforeAll(async () => {
    // Generate deterministic test keypairs
    serverKeypair = StellarSdk.Keypair.fromSecret(
      'SCZT7W6F3VHGLKQPQY5XQZJ4YR3LMZP6NQBXVYWZ2UHRL4KQMNXWD3TC',
    );
    clientKeypair = StellarSdk.Keypair.random();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [Sep10Module],
    })
      .overrideProvider(getRepositoryToken(Sep10Service))
      .useValue({
        buildChallenge: jest.fn(),
        verifyChallenge: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    sep10Service = moduleFixture.get(Sep10Service);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /.well-known/stellar.toml', () => {
    it('returns valid stellar.toml content', async () => {
      const response = await request(app.getHttpServer())
        .get('/.well-known/stellar.toml')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('ACCOUNTS=');
      expect(response.text).toContain('WEB_AUTH_ENDPOINT=');
      expect(response.text).toContain('SIGNING_KEY=');
      expect(response.text).toContain(serverKeypair.publicKey());
    });

    it('includes CORS headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/.well-known/stellar.toml')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('GET /auth', () => {
    it('returns challenge transaction for valid account', async () => {
      const mockXdr = 'AAAA...base64xdr';
      jest.spyOn(sep10Service, 'buildChallenge').mockReturnValue(mockXdr);

      const response = await request(app.getHttpServer())
        .get(`/auth?account=${clientKeypair.publicKey()}`)
        .expect(200);

      expect(response.body.transaction).toBe(mockXdr);
      expect(response.body.network_passphrase).toBe(networkPassphrase);
    });

    it('returns 400 for invalid account format', async () => {
      await request(app.getHttpServer())
        .get('/auth?account=INVALID_ACCOUNT')
        .expect(400);
    });

    it('returns 400 when account parameter is missing', async () => {
      await request(app.getHttpServer()).get('/auth').expect(400);
    });
  });

  describe('POST /auth', () => {
    it('returns JWT for valid signed challenge', async () => {
      const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.token';
      jest.spyOn(sep10Service, 'verifyChallenge').mockReturnValue(mockJwt);

      const response = await request(app.getHttpServer())
        .post('/auth')
        .send({
          account: clientKeypair.publicKey(),
          transaction: 'AAAA...signed_xdr',
        })
        .expect(200);

      expect(response.body.token).toBe(mockJwt);
    });

    it('returns 400 for malformed transaction', async () => {
      await request(app.getHttpServer())
        .post('/auth')
        .send({
          account: clientKeypair.publicKey(),
          transaction: 'invalid_xdr',
        })
        .expect(400);
    });

    it('returns 401 for expired challenge', async () => {
      jest.spyOn(sep10Service, 'verifyChallenge').mockImplementation(() => {
        throw new Error('Challenge has expired');
      });

      await request(app.getHttpServer())
        .post('/auth')
        .send({
          account: clientKeypair.publicKey(),
          transaction: 'AAAA...expired_xdr',
        })
        .expect(401);
    });

    it('returns 401 for invalid client signature', async () => {
      jest.spyOn(sep10Service, 'verifyChallenge').mockImplementation(() => {
        throw new Error('Transaction not signed by client account');
      });

      await request(app.getHttpServer())
        .post('/auth')
        .send({
          account: clientKeypair.publicKey(),
          transaction: 'AAAA...unsigned_xdr',
        })
        .expect(401);
    });
  });

  describe('Full SEP-10 Flow Integration', () => {
    it('completes full authentication flow', async () => {
      // Step 1: Get challenge
      const challengeResponse = await request(app.getHttpServer())
        .get(`/auth?account=${clientKeypair.publicKey()}`)
        .expect(200);

      const challengeXdr = challengeResponse.body.transaction;
      expect(challengeXdr).toBeDefined();

      // Step 2: Parse and sign challenge (simulating wallet behavior)
      const tx = new StellarSdk.Transaction(
        StellarSdk.xdr.TransactionEnvelope.fromXDR(challengeXdr, 'base64'),
        networkPassphrase,
      );

      // Verify server signature exists
      const txHash = tx.hash();
      const serverSigned = tx.signatures.some((sig) =>
        serverKeypair.verify(txHash, sig.signature()),
      );
      expect(serverSigned).toBe(true);

      // Sign with client keypair
      tx.sign(clientKeypair);
      const signedXdr = tx.toEnvelope().toXDR('base64');

      // Step 3: Submit signed challenge
      const authResponse = await request(app.getHttpServer())
        .post('/auth')
        .send({
          account: clientKeypair.publicKey(),
          transaction: signedXdr,
        })
        .expect(200);

      expect(authResponse.body.token).toBeDefined();
      expect(typeof authResponse.body.token).toBe('string');
    });
  });
});
