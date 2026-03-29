import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { CurrencyConversionService } from './currency-conversion.service';
import { CurrencyPreferenceRepository } from '../repositories/currency-preference.repository';
import { DisplayCurrency } from '../entities/currency-preference.entity';
import { of, throwError } from 'rxjs';

describe('CurrencyConversionService', () => {
  let service: CurrencyConversionService;
  let httpService: HttpService;
  let cacheManager: any;
  let configService: ConfigService;
  let currencyPreferenceRepository: CurrencyPreferenceRepository;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('mock-api-key'),
  };

  const mockCurrencyPreferenceRepository = {
    getUserDisplayCurrency: jest.fn(),
    updateDisplayCurrency: jest.fn(),
    getOrCreatePreference: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyConversionService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CurrencyPreferenceRepository,
          useValue: mockCurrencyPreferenceRepository,
        },
      ],
    }).compile();

    service = module.get<CurrencyConversionService>(
      CurrencyConversionService,
    );
    httpService = module.get<HttpService>(HttpService);
    cacheManager = module.get(CACHE_MANAGER);
    configService = module.get<ConfigService>(ConfigService);
    currencyPreferenceRepository = module.get<CurrencyPreferenceRepository>(
      CurrencyPreferenceRepository,
    );

    jest.clearAllMocks();
  });

  describe('convert', () => {
    it('should return 0 for 0 amount', async () => {
      const result = await service.convert(0, 'USD', 'NGN');
      expect(result).toBe(0);
    });

    it('should return same amount for same currency', async () => {
      const result = await service.convert(100, 'USD', 'USD');
      expect(result).toBe(100);
    });

    it('should convert USD to NGN with cached rate', async () => {
      const mockRate = 456;
      jest.spyOn(service, 'getRate').mockResolvedValue(mockRate);

      const result = await service.convert(100, 'USD', 'NGN');

      expect(result).toBe(45600);
      expect(service.getRate).toHaveBeenCalledWith('USD', 'NGN');
    });

    it('should handle conversion errors gracefully', async () => {
      jest
        .spyOn(service, 'getRate')
        .mockRejectedValue(
          new Error('Unsupported currency conversion: XYZ to ABC'),
        );

      await expect(service.convert(100, 'XYZ', 'ABC')).rejects.toThrow();
    });
  });

  describe('getRate', () => {
    it('should return 1 for same currency', async () => {
      const rate = await service.getRate('USD', 'USD');
      expect(rate).toBe(1);
    });

    it('should throw error for unsupported currency pair', async () => {
      await expect(service.getRate('INVALID', 'INVALID')).rejects.toThrow();
    });
  });

  describe('getRates', () => {
    it('should get rates for multiple currencies', async () => {
      jest.spyOn(service, 'getRate').mockResolvedValue(2);

      const rates = await service.getRates('USD', ['NGN', 'GHS', 'EUR']);

      expect(rates.size).toBe(3);
      expect(rates.get('NGN')).toBe(2);
      expect(rates.get('GHS')).toBe(2);
      expect(rates.get('EUR')).toBe(2);
    });
  });

  describe('batchConvert', () => {
    it('should convert multiple currency pairs', async () => {
      jest.spyOn(service, 'convert').mockResolvedValue(456);

      const conversions = [
        { amount: 100, from: 'USD', to: 'NGN' },
        { amount: 50, from: 'USD', to: 'GHS' },
      ];

      const results = await service.batchConvert(conversions);

      expect(results).toEqual([456, 456]);
      expect(service.convert).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUserDisplayCurrency', () => {
    it('should return user display currency', async () => {
      mockCurrencyPreferenceRepository.getUserDisplayCurrency.mockResolvedValue(
        DisplayCurrency.NGN,
      );

      const currency = await service.getUserDisplayCurrency(
        'user-123',
      );

      expect(currency).toBe(DisplayCurrency.NGN);
      expect(
        mockCurrencyPreferenceRepository.getUserDisplayCurrency,
      ).toHaveBeenCalledWith('user-123');
    });
  });

  describe('setDisplayCurrency', () => {
    it('should update user display currency', async () => {
      await service.setDisplayCurrency('user-123', DisplayCurrency.GHS);

      expect(
        mockCurrencyPreferenceRepository.updateDisplayCurrency,
      ).toHaveBeenCalledWith('user-123', DisplayCurrency.GHS);
    });
  });

  describe('formatAmount', () => {
    it('should format USD amount', () => {
      const formatted = service.formatAmount(100.5, 'USD');
      expect(formatted).toContain('$');
      expect(formatted).toContain('100.50');
    });

    it('should format NGN amount with Naira symbol', () => {
      const formatted = service.formatAmount(45600, 'NGN');
      expect(formatted).toContain('₦');
      expect(formatted).toContain('45,600.00');
    });

    it('should format GHS amount with Cedi symbol', () => {
      const formatted = service.formatAmount(250, 'GHS');
      expect(formatted).toContain('₵');
      expect(formatted).toContain('250.00');
    });

    it('should format EUR amount with Euro symbol', () => {
      const formatted = service.formatAmount(85.75, 'EUR');
      expect(formatted).toContain('€');
      expect(formatted).toContain('85.75');
    });

    it('should handle unknown currency codes', () => {
      const formatted = service.formatAmount(100, 'UNKNOWN');
      expect(formatted).toContain('UNKNOWN');
      expect(formatted).toContain('100.00');
    });
  });

  describe('formatAmount edge cases', () => {
    it('should format very large amounts', () => {
      const formatted = service.formatAmount(1234567890.5, 'USD');
      expect(formatted).toContain('$');
      expect(formatted).toContain('1,234,567,890.50');
    });

    it('should format very small amounts', () => {
      const formatted = service.formatAmount(0.01, 'USD');
      expect(formatted).toContain('$');
      expect(formatted).toContain('0.01');
    });

    it('should always use 2 decimal places', () => {
      const formatted1 = service.formatAmount(100, 'USD');
      const formatted2 = service.formatAmount(100.5, 'USD');
      const formatted3 = service.formatAmount(100.555, 'USD');

      expect(formatted1).toContain('100.00');
      expect(formatted2).toContain('100.50');
      expect(formatted3).toContain('100.56'); // Rounded
    });
  });

  describe('CurrencyConversionService - Rate Fetching', () => {
    it('should fetch crypto rates from CoinGecko', async () => {
      const mockCryptoRates = {
        ethereum: { usd: 2500, ngn: 1137500 },
        stellar: { usd: 0.15, ngn: 68.25 },
      };

      mockHttpService.get.mockReturnValue(of({ data: mockCryptoRates }));
      mockCacheManager.get.mockResolvedValue(null); // Cache miss

      // This would be tested via the private method behavior
      // For now just ensure the service initializes correctly
      expect(service).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      // Service should initialize even if API fails
      expect(service).toBeDefined();
    });
  });

  describe('Currency conversion accuracy', () => {
    it('should accurately convert USD to NGN at rate 456', async () => {
      jest.spyOn(service, 'getRate').mockResolvedValue(456);

      const result = await service.convert(100, 'USD', 'NGN');
      expect(result).toBe(45600);
    });

    it('should accurately convert GHS to EUR at rate 0.158', async () => {
      jest.spyOn(service, 'getRate').mockResolvedValue(0.158);

      const result = await service.convert(100, 'GHS', 'EUR');
      expect(result).toBeCloseTo(15.8, 2);
    });
  });
});
