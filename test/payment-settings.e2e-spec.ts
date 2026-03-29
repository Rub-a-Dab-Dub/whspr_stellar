import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { CurrencyConversionService } from '../../payment-settings/services/currency-conversion.service';
import { CurrencyPreferenceRepository } from '../../payment-settings/repositories/currency-preference.repository';
import { CurrencyController } from '../../payment-settings/controllers/currency.controller';
import { DisplayCurrency } from '../../payment-settings/entities/currency-preference.entity';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

describe('Currency Controller (E2E)', () => {
  let app: INestApplication;
  let currencyConversionService: CurrencyConversionService;
  let currencyPreferenceRepository: CurrencyPreferenceRepository;

  const mockCurrencyConversionService = {
    convert: jest.fn(),
    getRate: jest.fn(),
    getRates: jest.fn(),
    getUserDisplayCurrency: jest.fn(),
    setDisplayCurrency: jest.fn(),
    formatAmount: jest.fn(),
    refreshRates: jest.fn(),
  };

  const mockCurrencyPreferenceRepository = {
    getOrCreatePreference: jest.fn(),
    getUserDisplayCurrency: jest.fn(),
    updateDisplayCurrency: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn().mockReturnValue({ id: 'user-123' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CurrencyController],
      providers: [
        {
          provide: CurrencyConversionService,
          useValue: mockCurrencyConversionService,
        },
        {
          provide: CurrencyPreferenceRepository,
          useValue: mockCurrencyPreferenceRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = { id: 'user-123' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    currencyConversionService = moduleFixture.get<CurrencyConversionService>(
      CurrencyConversionService,
    );
    currencyPreferenceRepository = moduleFixture.get<CurrencyPreferenceRepository>(
      CurrencyPreferenceRepository,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /currency/rates', () => {
    it('should return all exchange rates', async () => {
      mockCurrencyConversionService.refreshRates.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .get('/currency/rates')
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('cryptoRates');
      expect(response.body).toHaveProperty('fiatRates');
      expect(response.body).toHaveProperty('lastUpdated');
    });

    it('should handle rate refresh errors', async () => {
      mockCurrencyConversionService.refreshRates.mockRejectedValue(
        new Error('API Error'),
      );

      // Should still return a response but without data
      const response = await request(app.getHttpServer())
        .get('/currency/rates')
        .expect(HttpStatus.OK);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /currency/convert', () => {
    it('should convert USD to NGN', async () => {
      mockCurrencyConversionService.convert.mockResolvedValue(45600);
      mockCurrencyConversionService.getRate.mockResolvedValue(456);
      mockCurrencyConversionService.formatAmount.mockReturnValue('₦45,600.00');

      const response = await request(app.getHttpServer())
        .get('/currency/convert?from=USD&to=NGN&amount=100')
        .expect(HttpStatus.OK);

      expect(response.body.amount).toBe(100);
      expect(response.body.from).toBe('USD');
      expect(response.body.to).toBe('NGN');
      expect(response.body.result).toBe(45600);
      expect(response.body.rate).toBe(456);
      expect(response.body.formatted).toBe('₦45,600.00');
    });

    it('should handle zero amount conversion', async () => {
      mockCurrencyConversionService.convert.mockResolvedValue(0);
      mockCurrencyConversionService.getRate.mockResolvedValue(456);
      mockCurrencyConversionService.formatAmount.mockReturnValue('₦0.00');

      const response = await request(app.getHttpServer())
        .get('/currency/convert?from=USD&to=NGN&amount=0')
        .expect(HttpStatus.OK);

      expect(response.body.result).toBe(0);
    });

    it('should handle same currency conversion', async () => {
      mockCurrencyConversionService.convert.mockResolvedValue(100);
      mockCurrencyConversionService.getRate.mockResolvedValue(1);
      mockCurrencyConversionService.formatAmount.mockReturnValue('$100.00');

      const response = await request(app.getHttpServer())
        .get('/currency/convert?from=USD&to=USD&amount=100')
        .expect(HttpStatus.OK);

      expect(response.body.result).toBe(100);
      expect(response.body.rate).toBe(1);
    });

    it('should return 400 for invalid currency pair', async () => {
      mockCurrencyConversionService.convert.mockRejectedValue(
        new Error('Unsupported currency conversion: XYZ to ABC'),
      );

      const response = await request(app.getHttpServer())
        .get('/currency/convert?from=XYZ&to=ABC&amount=100')
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toContain('Conversion failed');
    });

    it('should return 400 for missing query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/currency/convert?from=USD')
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toBeDefined();
    });

    it('should handle negative amount', async () => {
      // Query parser handles validation, controller assumes valid input
      mockCurrencyConversionService.convert.mockResolvedValue(-45600);
      mockCurrencyConversionService.getRate.mockResolvedValue(456);
      mockCurrencyConversionService.formatAmount.mockReturnValue('₦-45,600.00');

      // Should still process but with negative result
      const response = await request(app.getHttpServer())
        .get('/currency/convert?from=USD&to=NGN&amount=-100')
        .expect(HttpStatus.OK);

      expect(response.body.result).toBe(-45600);
    });
  });

  describe('GET /settings/currency', () => {
    it('should return user currency preference', async () => {
      mockCurrencyPreferenceRepository.getOrCreatePreference.mockResolvedValue({
        id: 'pref-123',
        userId: 'user-123',
        displayCurrency: DisplayCurrency.NGN,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app.getHttpServer())
        .get('/settings/currency')
        .set('Authorization', 'Bearer mock-token')
        .expect(HttpStatus.OK);

      expect(response.body.userId).toBe('user-123');
      expect(response.body.displayCurrency).toBe('NGN');
    });

    it('should create default preference if not exists', async () => {
      const mockPreference = {
        id: 'pref-new',
        userId: 'user-123',
        displayCurrency: DisplayCurrency.USD,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCurrencyPreferenceRepository.getOrCreatePreference.mockResolvedValue(
        mockPreference,
      );

      const response = await request(app.getHttpServer())
        .get('/settings/currency')
        .set('Authorization', 'Bearer mock-token')
        .expect(HttpStatus.OK);

      expect(response.body.displayCurrency).toBe('USD');
      expect(
        mockCurrencyPreferenceRepository.getOrCreatePreference,
      ).toHaveBeenCalledWith('user-123');
    });

    it('should return 401 without authorization', async () => {
      await request(app.getHttpServer())
        .get('/settings/currency')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('PATCH /settings/currency', () => {
    it('should update user currency preference', async () => {
      const mockUpdatedPreference = {
        id: 'pref-123',
        userId: 'user-123',
        displayCurrency: DisplayCurrency.GHS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCurrencyConversionService.setDisplayCurrency.mockResolvedValue(
        undefined,
      );
      mockCurrencyPreferenceRepository.getOrCreatePreference.mockResolvedValue(
        mockUpdatedPreference,
      );

      const response = await request(app.getHttpServer())
        .patch('/settings/currency')
        .set('Authorization', 'Bearer mock-token')
        .send({ displayCurrency: 'GHS' })
        .expect(HttpStatus.OK);

      expect(response.body.displayCurrency).toBe('GHS');
      expect(mockCurrencyConversionService.setDisplayCurrency).toHaveBeenCalledWith(
        'user-123',
        'GHS',
      );
    });

    it('should update from USD to NGN', async () => {
      const mockUpdatedPreference = {
        id: 'pref-123',
        userId: 'user-123',
        displayCurrency: DisplayCurrency.NGN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCurrencyConversionService.setDisplayCurrency.mockResolvedValue(
        undefined,
      );
      mockCurrencyPreferenceRepository.getOrCreatePreference.mockResolvedValue(
        mockUpdatedPreference,
      );

      const response = await request(app.getHttpServer())
        .patch('/settings/currency')
        .set('Authorization', 'Bearer mock-token')
        .send({ displayCurrency: 'NGN' })
        .expect(HttpStatus.OK);

      expect(response.body.displayCurrency).toBe('NGN');
    });

    it('should return 400 for invalid currency code', async () => {
      const response = await request(app.getHttpServer())
        .patch('/settings/currency')
        .set('Authorization', 'Bearer mock-token')
        .send({ displayCurrency: 'INVALID' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toBeDefined();
    });

    it('should return 401 without authorization', async () => {
      await request(app.getHttpServer())
        .patch('/settings/currency')
        .send({ displayCurrency: 'NGN' })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should accept all valid currencies', async () => {
      const validCurrencies = ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP'];

      for (const currency of validCurrencies) {
        mockCurrencyConversionService.setDisplayCurrency.mockResolvedValue(
          undefined,
        );
        mockCurrencyPreferenceRepository.getOrCreatePreference.mockResolvedValue(
          {
            id: 'pref-123',
            userId: 'user-123',
            displayCurrency: currency,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        );

        const response = await request(app.getHttpServer())
          .patch('/settings/currency')
          .set('Authorization', 'Bearer mock-token')
          .send({ displayCurrency: currency })
          .expect(HttpStatus.OK);

        expect(response.body.displayCurrency).toBe(currency);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockCurrencyConversionService.convert.mockRejectedValue(
        new Error('Service error'),
      );

      const response = await request(app.getHttpServer())
        .get('/currency/convert?from=USD&to=NGN&amount=100')
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toContain('Conversion failed');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app.getHttpServer())
        .patch('/settings/currency')
        .set('Authorization', 'Bearer mock-token')
        .send({})
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toBeDefined();
    });
  });
});
