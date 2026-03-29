export type ParsedGateAsset = { kind: 'native' } | { kind: 'credit'; code: string; issuer: string };

export function parseGateAsset(gateToken: string): ParsedGateAsset | null {
  const t = gateToken.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === 'native' || lower === 'xlm') {
    return { kind: 'native' };
  }
  const idx = t.indexOf(':');
  if (idx <= 0 || idx === t.length - 1) {
    return null;
  }
  const code = t.slice(0, idx).trim();
  const issuer = t.slice(idx + 1).trim();
  if (!code || !issuer) {
    return null;
  }
  return { kind: 'credit', code, issuer };
}
