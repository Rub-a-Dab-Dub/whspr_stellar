import { createHash } from 'crypto';

export function redisContractPrefix(contractAddress: string): string {
  const h = createHash('sha256').update(contractAddress).digest('hex').slice(0, 32);
  return `soroban:cs:v1:c:${h}`;
}

export function redisEntryKey(contractAddress: string, stateKey: string): string {
  const kh = createHash('sha256').update(stateKey).digest('hex').slice(0, 32);
  return `${redisContractPrefix(contractAddress)}:k:${kh}`;
}

export function redisContractPattern(contractAddress: string): string {
  return `${redisContractPrefix(contractAddress)}:*`;
}
