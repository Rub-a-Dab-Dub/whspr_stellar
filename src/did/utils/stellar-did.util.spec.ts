import {
  buildMinimalDidDocument,
  buildStellarDid,
  isValidStellarPublicKey,
  parseStellarAccountFromDid,
} from './stellar-did.util';

const VALID_G = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';

describe('stellar-did.util', () => {
  it('buildStellarDid and parse round-trip with network', () => {
    const did = buildStellarDid(VALID_G, 'testnet');
    expect(did).toBe(`did:stellar:testnet:${VALID_G}`);
    expect(parseStellarAccountFromDid(did)).toBe(VALID_G);
  });

  it('parseStellarAccountFromDid supports 3-part form', () => {
    const did = `did:stellar:${VALID_G}`;
    expect(parseStellarAccountFromDid(did)).toBe(VALID_G);
  });

  it('parseStellarAccountFromDid returns null for non-stellar', () => {
    expect(parseStellarAccountFromDid('did:key:x')).toBeNull();
  });

  it('isValidStellarPublicKey rejects garbage', () => {
    expect(isValidStellarPublicKey('not-a-key')).toBe(false);
  });

  it('buildStellarDid throws on invalid key', () => {
    expect(() => buildStellarDid('bad')).toThrow('Invalid Stellar public key');
  });

  it('buildMinimalDidDocument includes verificationMethod', () => {
    const did = buildStellarDid(VALID_G, 'public');
    const doc = buildMinimalDidDocument(did, VALID_G);
    expect(doc.id).toBe(did);
    expect(Array.isArray(doc.verificationMethod)).toBe(true);
  });
});
