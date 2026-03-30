import { parseGateAsset } from './gate-asset.util';

describe('parseGateAsset', () => {
  it('parses native aliases', () => {
    expect(parseGateAsset('native')).toEqual({ kind: 'native' });
    expect(parseGateAsset('XLM')).toEqual({ kind: 'native' });
  });

  it('parses CODE:ISSUER', () => {
    expect(parseGateAsset('USDC:GABCDEF')).toEqual({
      kind: 'credit',
      code: 'USDC',
      issuer: 'GABCDEF',
    });
  });

  it('returns null for invalid', () => {
    expect(parseGateAsset('')).toBeNull();
    expect(parseGateAsset('nocolon')).toBeNull();
  });
});
