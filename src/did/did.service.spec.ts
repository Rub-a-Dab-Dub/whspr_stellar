import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOneOptions } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { generateKeyPairSync, sign } from 'crypto';
import { DidService } from './did.service';
import { DidRecord } from './entities/did-record.entity';
import { VerifiableCredential } from './entities/verifiable-credential.entity';
import { canonicalCredentialPayload } from './utils/vc-crypto.util';
import { buildStellarDid } from './utils/stellar-did.util';

describe('DidService', () => {
  let service: DidService;
  let didRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let vcRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
  };

  const userId = 'user-uuid-1';
  const stellarPk = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';

  beforeEach(async () => {
    didRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'did-row-1', ...x })),
      find: jest.fn(),
    };
    vcRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'vc-1', ...x })),
      find: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DidService,
        { provide: getRepositoryToken(DidRecord), useValue: didRepo },
        { provide: getRepositoryToken(VerifiableCredential), useValue: vcRepo },
      ],
    }).compile();

    service = module.get(DidService);
  });

  it('registerDID stellar builds did:stellar and stores document', async () => {
    didRepo.findOne.mockResolvedValue(null);
    const row = await service.registerDID(userId, {
      method: 'stellar',
      stellarPublicKey: stellarPk,
      stellarNetwork: 'testnet',
    });
    expect(row.did).toBe(buildStellarDid(stellarPk, 'testnet'));
    expect(didRepo.save).toHaveBeenCalled();
  });

  it('registerDID stellar rejects invalid key', async () => {
    await expect(
      service.registerDID(userId, { method: 'stellar', stellarPublicKey: 'not-stellar' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolveDID returns document', async () => {
    const doc = { id: 'did:x' };
    didRepo.findOne.mockResolvedValue({
      id: '1',
      userId,
      did: 'did:x',
      didDocument: doc,
      method: 'web',
      isVerified: false,
      createdAt: new Date(),
    } as unknown as DidRecord);
    await expect(service.resolveDID('did:x')).resolves.toEqual(doc);
  });

  it('resolveDID throws when missing', async () => {
    didRepo.findOne.mockResolvedValue(null);
    await expect(service.resolveDID('did:none')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('verifyCredential rejects revoked stored credential', async () => {
    vcRepo.findOne.mockResolvedValue({
      id: 'vc',
      userId,
      didId: 'd',
      credentialType: 't',
      issuer: 'did:i',
      credentialSubject: {},
      proof: {},
      issuedAt: new Date(),
      expiresAt: null,
      isRevoked: true,
      revokedAt: new Date(),
      showOnProfile: false,
      createdAt: new Date(),
    } as unknown as VerifiableCredential);

    const out = await service.verifyCredential({ credentialId: 'vc' });
    expect(out.valid).toBe(false);
    expect(out.reasons).toContain('revoked');
  });

  it('verifyCredential rejects expired inline credential', async () => {
    didRepo.findOne.mockResolvedValue({
      id: 'iss',
      userId: 'u2',
      did: 'did:issuer',
      didDocument: { ed25519PublicKeyHex: 'aa'.repeat(32) },
      method: 'key',
      isVerified: true,
      createdAt: new Date(),
    } as unknown as DidRecord);

    const out = await service.verifyCredential({
      credential: {
        credentialType: 't',
        issuer: 'did:issuer',
        credentialSubject: {},
        proof: { type: 'Ed25519Signature2020', proofValue: 'abc' },
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
    });
    expect(out.valid).toBe(false);
    expect(out.reasons).toContain('expired');
  });

  it('issueCredential verifies proof for key-method issuer', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
    const issuerDid = 'did:key:test-issuer';

    const holderDidRow = {
      id: 'holder-did',
      userId,
      did: 'did:key:holder',
      didDocument: {},
      method: 'key' as const,
      isVerified: true,
      createdAt: new Date(),
    } as unknown as DidRecord;

    const issuerRow = {
      id: 'issuer-did',
      userId: 'other',
      did: issuerDid,
      didDocument: { ed25519PublicKeyJwkX: jwk.x },
      method: 'key' as const,
      isVerified: true,
      createdAt: new Date(),
    } as unknown as DidRecord;

    didRepo.findOne.mockImplementation(async (opts?: FindOneOptions<DidRecord>) => {
      const w = opts?.where;
      if (!w || Array.isArray(w)) return null;
      const where = w as { id?: string; did?: string; userId?: string };
      if (where.id === 'holder-did' && where.userId === userId) {
        return holderDidRow;
      }
      if (where.did === issuerDid) {
        return issuerRow;
      }
      return null;
    });

    const issuedAt = new Date().toISOString();
    const credBody = {
      credentialType: 'PersonCredential',
      issuer: issuerDid,
      credentialSubject: { id: 'subject' },
      issuedAt,
    };
    const toSign = canonicalCredentialPayload({ ...credBody, proof: {} });
    const sig = sign(null, Buffer.from(toSign, 'utf8'), privateKey).toString('base64');

    await service.issueCredential(userId, {
      didId: 'holder-did',
      credentialType: credBody.credentialType,
      issuer: issuerDid,
      credentialSubject: credBody.credentialSubject,
      proof: { type: 'Ed25519Signature2020', proofValue: sig },
      issuedAt,
      verifyProof: true,
    });

    expect(vcRepo.save).toHaveBeenCalled();
  });

  it('registerDID throws when stellar DID already exists', async () => {
    didRepo.findOne.mockResolvedValue({ id: 'x' } as unknown as DidRecord);
    await expect(
      service.registerDID(userId, {
        method: 'stellar',
        stellarPublicKey: stellarPk,
        stellarNetwork: 'testnet',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('registerDID key creates did:key uuid', async () => {
    didRepo.findOne.mockResolvedValue(null);
    const row = await service.registerDID(userId, { method: 'key' });
    expect(row.did.startsWith('did:key:')).toBe(true);
    expect(didRepo.save).toHaveBeenCalled();
  });

  it('registerDID web creates did:web uuid', async () => {
    didRepo.findOne.mockResolvedValue(null);
    const row = await service.registerDID(userId, { method: 'web' });
    expect(row.did.startsWith('did:web:')).toBe(true);
  });

  it('registerDID rejects unsupported method', async () => {
    await expect(service.registerDID(userId, { method: 'other' as any })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updateDIDDocument updates when owner and id matches', async () => {
    const did = 'did:web:test';
    didRepo.findOne.mockResolvedValue({
      id: 'rid',
      userId,
      did,
      didDocument: {},
      method: 'web',
      isVerified: false,
      createdAt: new Date(),
    } as unknown as DidRecord);
    const doc = { '@context': ['https://www.w3.org/ns/did/v1'], id: did, foo: 1 };
    await service.updateDIDDocument(userId, did, { did, didDocument: doc });
    expect(didRepo.save).toHaveBeenCalled();
  });

  it('updateDIDDocument throws when not owner', async () => {
    const did = 'did:web:x';
    didRepo.findOne.mockResolvedValue({
      id: 'r',
      userId: 'other',
      did,
      didDocument: {},
      method: 'web',
      isVerified: false,
      createdAt: new Date(),
    } as unknown as DidRecord);
    await expect(
      service.updateDIDDocument(userId, did, {
        did,
        didDocument: { id: did },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateDIDDocument throws when document id mismatches', async () => {
    const did = 'did:web:x';
    didRepo.findOne.mockResolvedValue({
      id: 'r',
      userId,
      did,
      didDocument: {},
      method: 'web',
      isVerified: false,
      createdAt: new Date(),
    } as unknown as DidRecord);
    await expect(
      service.updateDIDDocument(userId, did, {
        did,
        didDocument: { id: 'wrong' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('issueCredential throws when issuer DID unknown', async () => {
    didRepo.findOne.mockImplementation(async (opts?: FindOneOptions<DidRecord>) => {
      const w = opts?.where as { id?: string; userId?: string } | undefined;
      if (w?.id === 'holder' && w?.userId === userId) {
        return { id: 'holder', userId, did: 'd', didDocument: {}, method: 'key' } as unknown as DidRecord;
      }
      return null;
    });
    await expect(
      service.issueCredential(userId, {
        didId: 'holder',
        credentialType: 't',
        issuer: 'did:key:missing',
        credentialSubject: {},
        issuedAt: new Date().toISOString(),
        proof: { type: 'Ed25519Signature2020', proofValue: 'x' },
        verifyProof: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('issueCredential skips proof when verifyProof false', async () => {
    didRepo.findOne.mockImplementation(async (opts?: FindOneOptions<DidRecord>) => {
      const w = opts?.where as { id?: string; userId?: string; did?: string } | undefined;
      if (w?.id === 'h' && w?.userId === userId) {
        return { id: 'h', userId, did: 'dh', didDocument: {}, method: 'key' } as unknown as DidRecord;
      }
      if (w?.did === 'did:key:iss') {
        return {
          id: 'i',
          userId,
          did: 'did:key:iss',
          didDocument: {},
          method: 'key',
        } as unknown as DidRecord;
      }
      return null;
    });
    await service.issueCredential(userId, {
      didId: 'h',
      credentialType: 't',
      issuer: 'did:key:iss',
      credentialSubject: {},
      issuedAt: new Date().toISOString(),
      proof: { type: 'x', proofValue: 'nope' },
      verifyProof: false,
    });
    expect(vcRepo.save).toHaveBeenCalled();
  });

  it('verifyCredential with empty dto throws', async () => {
    await expect(service.verifyCredential({} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifyCredential credentialId path returns issuer_did_not_found', async () => {
    vcRepo.findOne.mockResolvedValue({
      id: 'vcid',
      userId,
      didId: 'd',
      credentialType: 't',
      issuer: 'did:key:nobody',
      credentialSubject: {},
      proof: { type: 'Ed25519Signature2020', proofValue: 'aa' },
      issuedAt: new Date(),
      expiresAt: null,
      isRevoked: false,
      revokedAt: null,
      showOnProfile: false,
      createdAt: new Date(),
    } as unknown as VerifiableCredential);
    didRepo.findOne.mockResolvedValue(null);
    const out = await service.verifyCredential({ credentialId: 'vcid' });
    expect(out.valid).toBe(false);
    expect(out.reasons).toContain('issuer_did_not_found');
  });

  it('verifyCredential rejects wrong user when userId passed', async () => {
    vcRepo.findOne.mockResolvedValue({
      id: 'vcid',
      userId: 'other',
      didId: 'd',
      credentialType: 't',
      issuer: 'did:key:x',
      credentialSubject: {},
      proof: {},
      issuedAt: new Date(),
      expiresAt: null,
      isRevoked: false,
      revokedAt: null,
      showOnProfile: false,
      createdAt: new Date(),
    } as unknown as VerifiableCredential);
    const out = await service.verifyCredential({ credentialId: 'vcid' } as any, userId);
    expect(out.valid).toBe(false);
    expect(out.reasons).toContain('forbidden');
  });

  it('revokeCredential and deleteCredential', async () => {
    const vc = {
      id: 'v1',
      userId,
      isRevoked: false,
    } as unknown as VerifiableCredential;
    vcRepo.findOne.mockResolvedValue(vc);
    vcRepo.save.mockResolvedValue({ ...vc, isRevoked: true } as VerifiableCredential);
    await service.revokeCredential(userId, 'v1');
    expect(vcRepo.save).toHaveBeenCalled();

    vcRepo.findOne.mockResolvedValue(vc);
    await service.deleteCredential(userId, 'v1');
    expect(vcRepo.remove).toHaveBeenCalledWith(vc);
  });

  it('linkCredential updates didId', async () => {
    const vc = { id: 'c1', userId, didId: 'old' } as unknown as VerifiableCredential;
    vcRepo.findOne.mockResolvedValueOnce(vc);
    didRepo.findOne.mockResolvedValue({
      id: 'newdid',
      userId,
      did: 'dn',
      didDocument: {},
      method: 'key',
      isVerified: true,
      createdAt: new Date(),
    } as unknown as DidRecord);
    vcRepo.save.mockImplementation(async (x) => x as VerifiableCredential);
    await service.linkCredential(userId, { credentialId: 'c1', didId: 'newdid' });
    expect(vc.didId).toBe('newdid');
    expect(vcRepo.save).toHaveBeenCalled();
  });

  it('getDIDByUser and listCredentials and getPublicProfileCredentials', async () => {
    didRepo.find.mockResolvedValue([]);
    await expect(service.getDIDByUser(userId)).resolves.toEqual([]);
    vcRepo.find.mockResolvedValue([]);
    await expect(service.listCredentials(userId)).resolves.toEqual([]);
    await expect(service.getPublicProfileCredentials(userId)).resolves.toEqual([]);
  });
});
