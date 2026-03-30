import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';
import { CurrencyPreferenceRepository } from '../repositories/currency-preference.repository';
import { DisplayCurrency } from '../entities/currency-preference.entity';

/**
 * Currency Conversion Rate Cache Keys
 */
const CACHE_KEYS = {
  CRYPTO_FIAT_RATES: 'rates:crypto:fiat', // All crypto-to-fiat rates
  FIAT_RATES: 'rates:fiat:fiat', // All fiat-to-fiat rates
  RATE_TIMESTAMP: 'rates:timestamp', // Last update timestamp
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Supported cryptocurrencies for rate fetching
 */
const CRYPTO_SYMBOLS = ['ethereum', 'stellar', 'bitcoin'];

/**
 * Supported fiat currencies
 */
const FIAT_CURRENCIES = ['usd', 'ngn', 'ghs', 'kes', 'zar', 'eur', 'gbp'];

interface ExchangeRate {
  [key: string]: number;
}

@Injectable()
export class CurrencyConversionService {
  private readonly logger = new Logger(CurrencyConversionService.name);
  private readonly coinGeckoBaseUrl = 'https://api.coingecko.com/api/v3';
  private readonly openExchangeRatesBaseUrl = 'https://openexchangerates.org/api';
  private readonly openExchangeRatesApiKey: string;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private httpService: HttpService,
    private configService: ConfigService,
    private currencyPreferenceRepository: CurrencyPreferenceRepository,
  ) {
    this.openExchangeRatesApiKey =
      this.configService.get<string>('OPEN_EXCHANGE_RATES_API_KEY') || '';
  }

  /**
   * Convert amount from one currency to another
   * Supports crypto-to-fiat, fiat-to-fiat, and cross-fiat conversions
   * For cross-fiat (e.g., NGN to GHS), bridges through USD
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    if (amount === 0) return 0;
    if (fromCurrency === toCurrency) return amount;

    const rate = await this.getRate(fromCurrency, toCurrency);
    return amount * rate;
  }

  /**
   * Get exchange rate between two currencies
   * Returns how many units of toCurrency equals 1 unit of fromCurrency
   */
  async getRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    const from = fromCurrency.toLowerCase();
    const to = toCurrency.toLowerCase();

    // Check if this is a crypto-to-fiat conversion
    if (CRYPTO_SYMBOLS.includes(from) && FIAT_CURRENCIES.includes(to)) {
      return this.getCryptoToFiatRate(from, to);
    }

    // Check if this is a fiat-to-fiat conversion
    if (FIAT_CURRENCIES.includes(from) && FIAT_CURRENCIES.includes(to)) {
      return this.getFiatToFiatRate(from, to);
    }

    // Unsupported pair - try to bridge through USD
    if (FIAT_CURRENCIES.includes(from) && FIAT_CURRENCIES.includes(to)) {
      const fromToUsd = await this.getFiatToFiatRate(from, 'usd');
      const usdToTarget = await this.getFiatToFiatRate('usd', to);
      return fromToUsd * usdToTarget;
    }

    throw new Error(
      `Unsupported currency conversion: ${fromCurrency} to ${toCurrency}`,
    );
  }

  /**
   * Get multiple rates at once (more efficient than individual calls)
   */
  async getRates(
    fromCurrency: string,
    toCurrencies: string[],
  ): Promise<Map<string, number>> {
    const rates = new Map<string, number>();

    const promises = toCurrencies.map(async (to) => {
      const rate = await this.getRate(fromCurrency, to);
      rates.set(to, rate);
    });

    await Promise.all(promises);
    return rates;
  }

  /**
   * Batch convert multiple amounts
   */
  async batchConvert(
    conversions: Array<{
      amount: number;
      from: string;
      to: string;
    }>,
  ): Promise<number[]> {
    return Promise.all(
      conversions.map(({ amount, from, to }) =>
        this.convert(amount, from, to),
      ),
    );
  }

  /**
   * Get user's display currency preference
   */
  async getUserDisplayCurrency(userId: string): Promise<DisplayCurrency> {
    return this.currencyPreferenceRepository.getUserDisplayCurrency(userId);
  }

  /**
   * Set user's display currency preference
   */
  async setDisplayCurrency(
    userId: string,
    currency: DisplayCurrency,
  ): Promise<void> {
    await this.currencyPreferenceRepository.updateDisplayCurrency(
      userId,
      currency,
    );
    this.logger.log(
      `User ${userId} display currency updated to ${currency}`,
    );
  }

  /**
   * Format amount with currency symbol
   */
  formatAmount(amount: number, currency: string): string {
    const currencySymbols: { [key: string]: string } = {
      usd: '$',
      ngn: '₦',
      ghs: '₵',
      kes: 'KSh',
      zar: 'R',
      eur: '€',
      gbp: '£',
    };

    const symbol = currencySymbols[currency.toLowerCase()] || currency;

    // Format number with 2 decimal places
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `${symbol}${formatted}`;
  }

  /**
   * Refresh all currency rates from external APIs
   * Called periodically via cron job
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshRates(): Promise<void> {
    try {
      this.logger.log('Refreshing currency rates...');

      // Fetch crypto-to-fiat rates
      await this.fetchCryptoToFiatRates();

      // Fetch fiat-to-fiat rates
      await this.fetchFiatToFiatRates();

      // Update timestamp
      await this.cacheManager.set(CACHE_KEYS.RATE_TIMESTAMP, Date.now(), {
        ttl: CACHE_TTL / 1000, // cache-manager expects seconds
      });

      this.logger.log('Currency rates refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh currency rates:', error);
    }
  }

  /**
   * Get crypto-to-fiat rate from cache or fetch from CoinGecko
   */
  private async getCryptoToFiatRate(
    crypto: string,
    fiat: string,
  ): Promise<number> {
    const rates = await this.getCachedCryptoFiatRates();

    if (rates && rates[crypto] && rates[crypto][fiat]) {
      return rates[crypto][fiat];
    }

    // Refresh if cache miss
    await this.fetchCryptoToFiatRates();
    const updatedRates = await this.getCachedCryptoFiatRates();

    if (updatedRates && updatedRates[crypto] && updatedRates[crypto][fiat]) {
      return updatedRates[crypto][fiat];
    }

    throw new Error(
      `Failed to fetch rate for ${crypto} to ${fiat}`,
    );
  }

  /**
   * Get fiat-to-fiat rate from cache or fetch from Open Exchange Rates
   */
  private async getFiatToFiatRate(
    from: string,
    to: string,
  ): Promise<number> {
    const rates = await this.getCachedFiatRates();

    if (rates && rates[from] && rates[from][to]) {
      return rates[from][to];
    }

    // Refresh if cache miss
    await this.fetchFiatToFiatRates();
    const updatedRates = await this.getCachedFiatRates();

    if (updatedRates && updatedRates[from] && updatedRates[from][to]) {
      return updatedRates[from][to];
    }

    throw new Error(
      `Failed to fetch rate for ${from} to ${to}`,
    );
  }

  /**
   * Fetch all crypto-to-fiat rates from CoinGecko and cache them
   */
  private async fetchCryptoToFiatRates(): Promise<void> {
    try {
      const url = `${this.coinGeckoBaseUrl}/simple/price`;
      const params = {
        ids: CRYPTO_SYMBOLS.join(','),
        vs_currencies: FIAT_CURRENCIES.join(','),
      };

      const { data } = await firstValueFrom(
        this.httpService.get<ExchangeRate>(url, { params }),
      );

      await this.cacheManager.set(CACHE_KEYS.CRYPTO_FIAT_RATES, data, {
        ttl: CACHE_TTL / 1000,
      });

      this.logger.debug('Crypto-to-fiat rates cached successfully');
    } catch (error) {
      this.logger.error('Failed to fetch crypto rates from CoinGecko:', error);
      throw error;
    }
  }

  /**
   * Fetch all fiat-to-fiat rates from Open Exchange Rates and cache them
   */
  private async fetchFiatToFiatRates(): Promise<void> {
    if (!this.openExchangeRatesApiKey) {
      this.logger.warn(
        'OPEN_EXCHANGE_RATES_API_KEY not configured, fiat rates unavailable',
      );
      return;
    }

    try {
      const url = `${this.openExchangeRatesBaseUrl}/latest`;
      const params = {
        app_id: this.openExchangeRatesApiKey,
        base: 'USD',
        symbols: FIAT_CURRENCIES.join(','),
      };

      const { data } = await firstValueFrom(
        this.httpService.get<{ rates: ExchangeRate }>(url, { params }),
      );

      // Transform into a matrix of fiat-to-fiat rates
      const fiatRates: { [key: string]: { [key: string]: number } } = {};

      for (const baseCurrency of FIAT_CURRENCIES) {
        if (!fiatRates[baseCurrency]) {
          fiatRates[baseCurrency] = {};
        }

        for (const targetCurrency of FIAT_CURRENCIES) {
          if (baseCurrency === 'usd') {
            fiatRates[baseCurrency][targetCurrency] =
              data.rates[targetCurrency];
          } else if (targetCurrency === 'usd') {
            fiatRates[baseCurrency][targetCurrency] =
              1 / data.rates[baseCurrency];
          } else {
            fiatRates[baseCurrency][targetCurrency] =
              data.rates[targetCurrency] / data.rates[baseCurrency];
          }
        }
      }

      await this.cacheManager.set(CACHE_KEYS.FIAT_RATES, fiatRates, {
        ttl: CACHE_TTL / 1000,
      });

      this.logger.debug('Fiat-to-fiat rates cached successfully');
    } catch (error) {
      this.logger.error(
        'Failed to fetch fiat rates from Open Exchange Rates:',
        error,
      );
      throw error;
    }
  }

  /**
   * Get cached crypto-to-fiat rates
   */
  private async getCachedCryptoFiatRates(): Promise<any> {
    return this.cacheManager.get(CACHE_KEYS.CRYPTO_FIAT_RATES);
  }

  /**
   * Get cached fiat-to-fiat rates
   */
  private async getCachedFiatRates(): Promise<any> {
    return this.cacheManager.get(CACHE_KEYS.FIAT_RATES);
  }
}
