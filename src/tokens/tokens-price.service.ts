import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Token } from './entities/token.entity';

@Injectable()
export class TokensPriceService {
  private readonly logger = new Logger(TokensPriceService.name);
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async fetchPrice(coingeckoId: string): Promise<number | null> {
    try {
      const url = `${this.baseUrl}/simple/price`;
      const { data } = await firstValueFrom(
        this.http.get(url, {
          params: { ids: coingeckoId, vs_currencies: 'usd' },
        }),
      );
      return data?.[coingeckoId]?.usd ?? null;
    } catch (err) {
      this.logger.warn(`CoinGecko fetch failed for ${coingeckoId}: ${err}`);
      return null;
    }
  }

  async fetchPricesBatch(tokens: Token[]): Promise<Map<string, number | null>> {
    const withIds = tokens.filter((t) => t.coingeckoId);
    const ids = withIds.map((t) => t.coingeckoId).join(',');
    const result = new Map<string, number | null>();

    if (!ids) return result;

    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/simple/price`, {
          params: { ids, vs_currencies: 'usd' },
        }),
      );
      for (const token of withIds) {
        result.set(token.id, data?.[token.coingeckoId!]?.usd ?? null);
      }
    } catch (err) {
      this.logger.warn(`CoinGecko batch fetch failed: ${err}`);
      for (const token of withIds) result.set(token.id, null);
    }

    return result;
  }
}
