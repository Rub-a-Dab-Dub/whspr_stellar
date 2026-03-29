import { parseFederationServerUrl } from './federation-toml.util';

describe('parseFederationServerUrl', () => {
  it('parses quoted federation URL', () => {
    const toml = `
NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
FEDERATION_SERVER="https://api.example.com/federation"
`;
    expect(parseFederationServerUrl(toml)).toBe('https://api.example.com/federation');
  });

  it('parses unquoted value', () => {
    expect(parseFederationServerUrl('FEDERATION_SERVER=https://fed.test/fed')).toBe(
      'https://fed.test/fed',
    );
  });

  it('returns null when missing', () => {
    expect(parseFederationServerUrl('VERSION=1\n')).toBeNull();
  });
});
