import { Keypair } from '@stellar/stellar-sdk';

/** did:stellar:<network>:<G...> or did:stellar:<G...> */
export function buildStellarDid(publicKey: string, network = 'testnet'): string {
  if (!isValidStellarPublicKey(publicKey)) {
    throw new Error('Invalid Stellar public key');
  }
  return `did:stellar:${network}:${publicKey}`;
}

export function isValidStellarPublicKey(address: string): boolean {
  try {
    Keypair.fromPublicKey(address);
    return /^G[A-Z2-7]{55}$/.test(address);
  } catch {
    return false;
  }
}

export function parseStellarAccountFromDid(did: string): string | null {
  const parts = did.split(':');
  if (parts[0] !== 'did' || parts[1] !== 'stellar') {
    return null;
  }
  if (parts.length === 3 && /^G[A-Z2-7]{55}$/.test(parts[2])) {
    return parts[2];
  }
  if (parts.length >= 4 && /^G[A-Z2-7]{55}$/.test(parts[3])) {
    return parts[3];
  }
  return null;
}

export function buildMinimalDidDocument(did: string, stellarAccount: string): Record<string, unknown> {
  const vmId = `${did}#keys-1`;
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    verificationMethod: [
      {
        id: vmId,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyBase58: stellarAccount,
      },
    ],
    authentication: [vmId],
  };
}
