import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Sep10Service } from './sep10.service';

describe('Sep10Service', () => {
  let service: Sep10Service;
  let jwtService: jest.Mocked<JwtService>;

  // Deterministic test keypairs
  const serverKeypair = StellarSdk.Keypair.random();
  const clientKeypair = StellarSdk.Keypair.random();
  const networkPassphrase = StellarSdk.Networks.TESTNET;
  const homeDomain = 'example.com';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Sep10Service,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                SEP10_SERVER_SECRET: serverKeypair.secret(),
                SOROBAN_NETWORK_PASSPHRASE: networkPassphrase,
                SEP10_HOME_DOMAIN: homeDomain,
                SEP10_WEB_AUTH_ENDPOINT: `https://${homeDomain}/auth`,
              };
              return map[key];
            },
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock.jwt.token') },
        },
      ],
    }).compile();

    service = module.get(Sep10Service);
    jwtService = module.get(JwtService);
  });

  describe('buildChallenge', () => {
    it('returns a valid base64 XDR transaction', () => {
      const xdr = service.buildChallenge(clientKeypair.publicKey());
      expect(typeof xdr).toBe('string');
      // Should be parseable
      const tx = new StellarSdk.Transaction(
        StellarSdk.xdr.TransactionEnvelope.fromXDR(xdr, 'base64'),
        networkPassphrase,
      );
      expect(tx.operations).toHaveLength(2);
    });

    it('first operation is manageData with client as source', () => {
      const xdr = service.buildChallenge(clientKeypair.publicKey());
      const tx = new StellarSdk.Transaction(
        StellarSdk.xdr.TransactionEnvelope.fromXDR(xdr, 'base64'),
        networkPassphrase,
      );
      const op = tx.operations[0] as StellarSdk.Operation.ManageData;
      expect(op.type).toBe('manageData');
      expect(op.source).toBe(clientKeypair.publicKey());
      expect(op.name).toBe(`${homeDomain} auth`);
    });

    it('second operation is web_auth_domain with server as source', () => {
      const xdr = service.buildChallenge(clientKeypair.publicKey());
      const tx = new StellarSdk.Transaction(
        StellarSdk.xdr.TransactionEnvelope.fromXDR(xdr, 'base64'),
        networkPassphrase,
      );
      const op = tx.operations[1] as StellarSdk.Operation.ManageData;
      expect(op.type).toBe('manageData');
      expect(op.name).toBe('web_auth_domain');
    });

    it('transaction is signed by server', () => {
      const xdr = service.buildChallenge(clientKeypair.publicKey());
      const tx = new StellarSdk.Transaction(
        StellarSdk.xdr.TransactionEnvelope.fromXDR(xdr, 'base64'),
        networkPassphrase,
      );
      const hash = tx.hash();
      const serverSigned = tx.signatures.some((sig) =>
        serverKeypair.verify(hash, sig.signature()),
      );
      expect(serverSigned).toBe(true);
    });

    it('sets time bounds with 5-minute expiry', () => {
      const before = Math.floor(Date.now() / 1000);
      const xdr = service.buildChallenge(clientKeypair.publicKey());
      const after = Math.floor(Date.now() / 1000);
      const tx = new StellarSdk.Transaction(
        StellarSdk.xdr.TransactionEnvelope.fromXDR(xdr, 'base64'),
        networkPassphrase,
      );
      const { minTime, maxTime } = tx.timeBounds!;
      expect(Number(minTime)).toBeGreaterThanOrEqual(before);
      expect(Number(maxTime)).toBeLessThanOrEqual(after + 300);
      expect(Number(maxTime) - Number(minTime)).toBe(300);
    });

    it('throws BadRequestException for invalid account', () => {
      expect(() => service.buildChallenge('INVALID')).toThrow(BadRequestException);
    });
  });

  describe('verifyChallenge', () => {
    function buildSignedChallenge(client = clientKeypair): string {
      const xdr = service.buildChallenge(client.publicKey());
      const tx = new StellarSdk.Transaction(
        StellarSdk.xdr.TransactionEnvelope.fromXDR(xdr, 'base64'),
        networkPassphrase,
      );
      tx.sign(client);
      return tx.toEnvelope().toXDR('base64');
    }

    it('returns a JWT for a valid signed challenge', () => {
      const signedXdr = buildSignedChallenge();
      const result = service.verifyChallenge(signedXdr, clientKeypair.publicKey());
      expect(result).toBe('mock.jwt.token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: clientKeypair.publicKey() },
        { expiresIn: '24h' },
      );
    });

    it('throws UnauthorizedException when client signature is missing', () => {
      const xdr = service.buildChallenge(clientKeypair.publicKey());
      // Not signed by client — only server signature present
      expect(() => service.verifyChallenge(xdr, clientKeypair.publicKey())).toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for expired challenge', () => {
      const xdr = service.buildChallenge(clientKeypair.publicKey());
      const tx = new StellarSdk.Transaction(
        StellarSdk.xdr.TransactionEnvelope.fromXDR(xdr, 'base64'),
        networkPassphrase,
      );
      tx.sign(clientKeypair);
      const signedXdr = tx.toEnvelope().toXDR('base64');

      // Mock Date.now to be past maxTime
      const realNow = Date.now;
      Date.now = () => realNow() + 400_000; // 400 seconds in the future
      try {
        expect(() => service.verifyChallenge(signedXdr, clientKeypair.publicKey())).toThrow(
          UnauthorizedException,
        );
      } finally {
        Date.now = realNow;
      }
    });

    it('throws BadRequestException for malformed XDR', () => {
      expect(() => service.verifyChallenge('not-valid-xdr', clientKeypair.publicKey())).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for invalid account', () => {
      expect(() => service.verifyChallenge('anything', 'INVALID')).toThrow(BadRequestException);
    });

    it('throws UnauthorizedException when account does not match first op source', () => {
      const otherKeypair = StellarSdk.Keypair.random();
      const signedXdr = buildSignedChallenge(clientKeypair);
      // Pass a different account than the one in the challenge
      expect(() => service.verifyChallenge(signedXdr, otherKeypair.publicKey())).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('serverPublicKey / toml accessors', () => {
    it('returns the server public key', () => {
      expect(service.serverPublicKey).toBe(serverKeypair.publicKey());
    });

    it('returns the home domain', () => {
      expect(service.tomlHomeDomain).toBe(homeDomain);
    });

    it('returns the web auth endpoint', () => {
      expect(service.tomlWebAuthEndpoint).toBe(`https://${homeDomain}/auth`);
    });
  });
});
