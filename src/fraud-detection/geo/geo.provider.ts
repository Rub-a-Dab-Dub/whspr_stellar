import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GeoData {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  org: string;
  isProxy: boolean;  // covers VPN + proxy
  isTor: boolean;
  lat: number;
  lon: number;
}

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^::1$/,
  /^localhost$/,
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((r) => r.test(ip));
}

@Injectable()
export class GeoProvider {
  private readonly logger = new Logger(GeoProvider.name);
  // ip-api.com free tier: 45 req/min, no key needed
  // Pro fields (proxy, hosting) need a paid key
  private readonly baseUrl = 'http://ip-api.com/json';

  constructor(private readonly config: ConfigService) {}

  async lookup(ip: string): Promise<GeoData | null> {
    // Return dummy data for local/private IPs so dev works offline
    if (isPrivateIP(ip)) {
      return {
        country: 'Local',
        countryCode: 'LO',
        region: 'Local',
        city: 'Local',
        isp: 'Local Network',
        org: 'Local Network',
        isProxy: false,
        isTor: false,
        lat: 0,
        lon: 0,
      };
    }

    try {
      const apiKey = this.config.get<string>('IPAPI_KEY', '');
      // Free tier fields
      const fields =
        'status,country,countryCode,regionName,city,isp,org,proxy,hosting,lat,lon,query';

      const url = apiKey
        ? `https://pro.ip-api.com/json/${ip}?fields=${fields}&key=${apiKey}`
        : `${this.baseUrl}/${ip}?fields=${fields}`;

      const { data } = await axios.get(url, { timeout: 5000 });

      if (data.status !== 'success') {
        this.logger.warn(`ip-api returned non-success for ${ip}: ${data.message}`);
        return null;
      }

      // Heuristic VPN detection on free tier: check if isp/org contains known VPN keywords
      const vpnKeywords = [
        'vpn', 'proxy', 'hosting', 'datacenter', 'cloud', 'server',
        'amazonaws', 'digitalocean', 'linode', 'vultr', 'ovh',
      ];
      const ispLower = (data.isp + ' ' + data.org).toLowerCase();
      const isVpnByHeuristic = vpnKeywords.some((k) => ispLower.includes(k));

      return {
        country: data.country ?? '',
        countryCode: data.countryCode ?? '',
        region: data.regionName ?? '',
        city: data.city ?? '',
        isp: data.isp ?? '',
        org: data.org ?? '',
        isProxy: data.proxy || data.hosting || isVpnByHeuristic,
        isTor: false, // ip-api free doesn't detect Tor; pro key exposes this
        lat: data.lat ?? 0,
        lon: data.lon ?? 0,
      };
    } catch (err) {
      this.logger.error(`Geo lookup failed for ${ip}`, err?.message);
      return null;
    }
  }
}