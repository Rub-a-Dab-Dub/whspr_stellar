import * as crypto from 'crypto';

export function generateAdminApiKey(): {
  rawKey: string;
  hash: string;
  prefix: string;
} {
  const random = crypto.randomBytes(24).toString('hex'); // 48 hex chars
  const rawKey = `gg_admin_${random}`;

  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

  return {
    rawKey,
    hash,
    prefix: rawKey.substring(0, 16),
  };
}
