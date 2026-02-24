import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminConfigService } from './admin-config.service';

describe('AdminConfigService', () => {
  let service: AdminConfigService;
  let mockConfigService: jest.Mocked<ConfigService>;

  const validEnv = {
    ADMIN_JWT_SECRET: 'test-secret',
    ADMIN_JWT_EXPIRES_IN: '2h',
    ADMIN_JWT_REFRESH_EXPIRES_IN: '7d',
    ADMIN_MAX_LOGIN_ATTEMPTS: 5,
    ADMIN_LOCKOUT_DURATION_MS: 1800000,
    ADMIN_RATE_LIMIT_PER_MINUTE: 60,
    ADMIN_LARGE_TRANSACTION_THRESHOLD: 10000,
  };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => (validEnv as Record<string, unknown>)[key]),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminConfigService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AdminConfigService>(AdminConfigService);
  });

  it('should return typed values when env is valid', () => {
    expect(service.jwtSecret).toBe('test-secret');
    expect(service.jwtExpiresIn).toBe('2h');
    expect(service.jwtRefreshExpiresIn).toBe('7d');
    expect(service.maxLoginAttempts).toBe(5);
    expect(service.lockoutDurationMs).toBe(1800000);
    expect(service.rateLimitPerMinute).toBe(60);
    expect(service.largeTransactionThreshold).toBe(10000);
  });

  it('should throw when ADMIN_JWT_SECRET is missing', () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'ADMIN_JWT_SECRET'
        ? undefined
        : (validEnv as Record<string, unknown>)[key],
    );

    expect(() => service.jwtSecret).toThrow('ADMIN_JWT_SECRET is required');
  });

  it('should throw when ADMIN_JWT_SECRET is empty string', () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'ADMIN_JWT_SECRET'
        ? ''
        : (validEnv as Record<string, unknown>)[key],
    );

    expect(() => service.jwtSecret).toThrow('ADMIN_JWT_SECRET is required');
  });
});
