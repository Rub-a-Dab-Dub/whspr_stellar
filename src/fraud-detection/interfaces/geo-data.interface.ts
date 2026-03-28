export interface GeoData {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  isProxy: boolean;   // VPN / proxy
  isTor: boolean;
  isp: string | null;
}
