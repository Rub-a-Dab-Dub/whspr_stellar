import { generateKeyPairSync, sign } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import {
  canonicalCredentialPayload,
  rawEd25519PublicKeyFromJwk,
  sortKeysDeep,
  verifyCredentialProof,
  verifyEd25519Detached,
  verifyStellarAccountEd25519Proof,
} from './vc-crypto.util';
import { buildStellarDid } from './stellar-did.util';

describe('vc-crypto.util', () => {
  it('sortKeysDeep sorts object keys recursively', () => {
    expect(sortKeysDeep({ z: 1, a: { y: 2, b: 3 } })).toEqual({
      a: { b: 3, y: 2 },
      z: 1,
    });
  });

  it('canonicalCredentialPayload omits proof and is stable', () => {
    const c = { b: 1, a: 2, proof: { x: 1 } };
    expect(canonicalCredentialPayload(c)).toBe('{"a":2,"b":1}');
  });

  it('verifyEd25519Detached accepts valid signature', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
    const raw = rawEd25519PublicKeyFromJwk(jwk.x);
    const msg = 'hello';
    const sig = sign(null, Buffer.from(msg, 'utf8'), privateKey).toString('base64');
    expect(verifyEd25519Detached(msg, sig, raw)).toBe(true);
    expect(verifyEd25519Detached(msg, sig, Buffer.alloc(31))).toBe(false);
  });

  it('verifyCredentialProof with ed25519PublicKeyJwkX', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
    const issuerDid = 'did:key:issuer-1';
    const issuedAt = new Date().toISOString();
    const cred = {
      credentialType: 'T',
      issuer: issuerDid,
      credentialSubject: { id: 's' },
      issuedAt,
      proof: {} as Record<string, unknown>,
    };
    const payload = canonicalCredentialPayload(cred);
    cred.proof = {
      type: 'Ed25519Signature2020',
      proofValue: sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64'),
    };
    const ok = verifyCredentialProof(cred, issuerDid, { ed25519PublicKeyJwkX: jwk.x }, 'key');
    expect(ok).toBe(true);
  });

  it('verifyCredentialProof with ed25519PublicKeyHex', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
    const hex = rawEd25519PublicKeyFromJwk(jwk.x).toString('hex');
    const issuerDid = 'did:key:hex-issuer';
    const issuedAt = new Date().toISOString();
    const cred = {
      credentialType: 'T',
      issuer: issuerDid,
      credentialSubject: {},
      issuedAt,
      proof: {} as Record<string, unknown>,
    };
    const payload = canonicalCredentialPayload(cred);
    cred.proof = {
      type: 'Ed25519Signature2020',
      proofValue: sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64'),
    };
    expect(verifyCredentialProof(cred, issuerDid, { ed25519PublicKeyHex: hex }, 'key')).toBe(true);
  });

  it('verifyStellarAccountEd25519Proof with Stellar keypair', () => {
    const kp = Keypair.random();
    const account = kp.publicKey();
    const msg = 'payload';
    const sig = kp.sign(Buffer.from(msg, 'utf8')).toString('base64');
    expect(verifyStellarAccountEd25519Proof(msg, sig, account)).toBe(true);
  });

  it('verifyCredentialProof stellar method uses account from DID', () => {
    const kp = Keypair.random();
    const account = kp.publicKey();
    const did = buildStellarDid(account, 'testnet');
    const issuedAt = new Date().toISOString();
    const cred = {
      credentialType: 'T',
      issuer: did,
      credentialSubject: {},
      issuedAt,
      proof: {} as Record<string, unknown>,
    };
    const payload = canonicalCredentialPayload(cred);
    cred.proof = {
      type: 'Ed25519Signature2020',
      proofValue: kp.sign(Buffer.from(payload, 'utf8')).toString('base64'),
    };
    expect(verifyCredentialProof(cred, did, {}, 'stellar')).toBe(true);
  });

  it('verifyCredentialProof false without proofValue', () => {
    expect(
      verifyCredentialProof(
        { credentialType: 'x', issuer: 'did:key:a', credentialSubject: {}, issuedAt: 't', proof: {} },
        'did:key:a',
        { ed25519PublicKeyJwkX: 'abc' },
        'key',
      ),
    ).toBe(false);
  });
});
