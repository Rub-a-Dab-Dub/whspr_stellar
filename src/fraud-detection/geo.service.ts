import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../cache/cache.service';
import { GeoData } from './interfaces/geo-data.interface';

const GEO_TTL = 3600; // 1 hour

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(
    private readonly http: HttpService,
    private readonly cache: CacheService,
  ) {}

  async lookup(ip: string): Promise<GeoData> {
    const cacheKey = `geo:${ip}`;
    const cached = await this.cache.get<GeoData>(cacheKey);
    if (cached) return cached;

    const result = await this.fetchFromApi(ip);
    await this.cache.set(cacheKey, result, GEO_TTL);
    return result;
  }

  private async fetchFromApi(ip: string): Promise<GeoData> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<IpApiResponse>(
          `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,proxy,hosting,isp`,
        ),
      );

      if (data.status !== 'success') {
        return this.unknown();
      }

      return {
        country: data.country ?? null,
        countryCode: data.countryCode ?? null,
        city: data.city ?? null,
        isProxy: data.proxy || data.hosting,
        isTor: false, // ip-api free tier doesn't expose Tor; extend with a Tor exit-node list if needed
        isp: data.isp ?? null,
      };
    } catch (err) {
      this.logger.error(`GeoService.lookup failed for ${ip}: ${(err as Error).message}`);
      return this.unknown();
    }
  }

  private unknown(): GeoData {
    return { country: null, countryCode: null, city: null, isProxy: false, isTor: false, isp: null };
  }
}

interface IpApiResponse {
  status: string;
  country?: string;
  countryCode?: string;
  city?: string;
  proxy: boolean;
  hosting: boolean;
  isp?: string;
}
