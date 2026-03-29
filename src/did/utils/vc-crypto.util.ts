import { createPublicKey, verify } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { parseStellarAccountFromDid, isValidStellarPublicKey } from './stellar-did.util';

export function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = sortKeysDeep(obj[k]);
  }
  return out;
}

/** Payload signed for VC verification (credential fields excluding `proof`). */
export function canonicalCredentialPayload(credential: Record<string, unknown>): string {
  const { proof: _p, ...rest } = credential;
  return JSON.stringify(sortKeysDeep(rest));
}

export function rawEd25519PublicKeyFromJwk(xBase64Url: string): Buffer {
  const pad = xBase64Url.length % 4 === 0 ? '' : '='.repeat(4 - (xBase64Url.length % 4));
  return Buffer.from(xBase64Url.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function verifyEd25519Detached(
  messageUtf8: string,
  signatureB64: string,
  publicKeyRaw32: Buffer,
): boolean {
  try {
    const jwk = {
      kty: 'OKP' as const,
      crv: 'Ed25519' as const,
      x: publicKeyRaw32.toString('base64url'),
    };
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    const sig = Buffer.from(signatureB64, 'base64');
    return verify(null, Buffer.from(messageUtf8, 'utf8'), key, sig);
  } catch {
    return false;
  }
}

/** Raw Ed25519 verify using the same public bytes as the Stellar StrKey account. */
export function verifyStellarAccountEd25519Proof(
  messageUtf8: string,
  signatureB64: string,
  stellarAccountId: string,
): boolean {
  try {
    if (!isValidStellarPublicKey(stellarAccountId)) {
      return false;
    }
    const kp = Keypair.fromPublicKey(stellarAccountId);
    const raw = Buffer.from(kp.rawPublicKey());
    return verifyEd25519Detached(messageUtf8, signatureB64, raw);
  } catch {
    return false;
  }
}

/**
 * Verifies `proof.proofValue` (base64) over canonical payload using issuer DID + optional stored DID document.
 */
export function verifyCredentialProof(
  credential: Record<string, unknown>,
  issuerDid: string,
  issuerDidDocument: Record<string, unknown>,
  issuerMethod: string,
): boolean {
  const proof = credential.proof as Record<string, unknown> | undefined;
  if (!proof || typeof proof.proofValue !== 'string') {
    return false;
  }
  const payload = canonicalCredentialPayload(credential);

  if (issuerMethod === 'stellar') {
    const account = parseStellarAccountFromDid(issuerDid);
    if (account) {
      return verifyStellarAccountEd25519Proof(payload, proof.proofValue as string, account);
    }
  }

  const hex = issuerDidDocument.ed25519PublicKeyHex;
  if (typeof hex === 'string' && /^[0-9a-fA-F]{64}$/.test(hex)) {
    const raw = Buffer.from(hex, 'hex');
    return verifyEd25519Detached(payload, proof.proofValue as string, raw);
  }

  const jwkX = issuerDidDocument.ed25519PublicKeyJwkX;
  if (typeof jwkX === 'string') {
    const raw = rawEd25519PublicKeyFromJwk(jwkX);
    return verifyEd25519Detached(payload, proof.proofValue as string, raw);
  }

  return false;
}
