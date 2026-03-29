/**
 * Extract FEDERATION_SERVER from stellar.toml (SEP-0001 / SEP-0002).
 */
export function parseFederationServerUrl(toml: string): string | null {
  const lines = toml.split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;
    const m = trimmed.match(/^FEDERATION_SERVER\s*=\s*(.+)$/iu);
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    v = v.replace(/^["']|["']$/gu, '').trim();
    if (v.length > 0) {
      return v;
    }
  }
  return null;
}
