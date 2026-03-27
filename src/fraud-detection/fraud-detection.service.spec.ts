import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudDetectionService } from './fraud-detection.service';
import { GeoService } from './geo.service';
import { LoginAttempt, LoginAction } from './entities/login-attempt.entity';
import { CacheService } from '../cache/cache.service';
import { GeoData } from './interfaces/geo-data.interface';

const mockGeo: GeoData = {
  country: 'United States',
  countryCode: 'US',
  city: 'New York',
  isProxy: false,
  isTor: false,
  isp: 'Comcast',
};

const makeAttempt = (overrides: Partial<LoginAttempt> = {}): LoginAttempt =>
  ({
    id: 'attempt-1',
    userId: 'user-1',
    ipAddress: '1.2.3.4',
    country: 'United States',
    countryCode: 'US',
    city: 'New York',
    isVPN: false,
    isTor: false,
    isSuspicious: false,
    riskScore: 0,
    action: LoginAction.ALLOWED,
    createdAt: new Date(),
    ...overrides,
  } as LoginAttempt);

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;
  let repo: jest.Mocked<Repository<LoginAttempt>>;
  let geoService: jest.Mocked<GeoService>;
  let redisMock: { sadd: jest.Mock; srem: jest.Mock; smembers: jest.Mock; sismember: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<LoginAttempt>>;

    geoService = { lookup: jest.fn() } as unknown as jest.Mocked<GeoService>;

    redisMock = {
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      sismember: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudDetectionService,
        { provide: getRepositoryToken(LoginAttempt), useValue: repo },
        { provide: GeoService, useValue: geoService },
        { provide: CacheService, useValue: {} },
        { provide: 'REDIS_CLIENT', useValue: redisMock },
      ],
    }).compile();

    service = module.get(FraudDetectionService);
  });

  // ─── analyzeLogin ─────────────────────────────────────────────────────────

  describe('analyzeLogin', () => {
    beforeEach(() => {
      geoService.lookup.mockResolvedValue(mockGeo);
      repo.create.mockImplementation((d) => d as LoginAttempt);
      repo.save.mockImplementation(async (d) => d as LoginAttempt);
      repo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ countryCode: 'US' }]),
      } as any);
      repo.find.mockResolvedValue([]);
    });

    it('returns ALLOWED for clean login from known country', async () => {
      const result = await service.analyzeLogin({ userId: 'user-1', ipAddress: '1.2.3.4' });
      expect(result.action).toBe(LoginAction.ALLOWED);
      expect(result.riskScore).toBe(0);
    });

    it('returns BLOCKED immediately for a blocked IP', async () => {
      redisMock.sismember.mockResolvedValue(1);
      const result = await service.analyzeLogin({ userId: 'user-1', ipAddress: '5.5.5.5' });
      expect(result.action).toBe(LoginAction.BLOCKED);
      expect(result.riskScore).toBe(100);
      expect(geoService.lookup).not.toHaveBeenCalled();
    });

    it('adds 30 points for VPN/proxy', async () => {
      geoService.lookup.mockResolvedValue({ ...mockGeo, isProxy: true });
      repo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ countryCode: 'US' }]),
      } as any);
      const result = await service.analyzeLogin({ userId: 'user-1', ipAddress: '1.2.3.4' });
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
    });

    it('adds 40 points for Tor', async () => {
      geoService.lookup.mockResolvedValue({ ...mockGeo, isTor: true });
      repo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ countryCode: 'US' }]),
      } as any);
      const result = await service.analyzeLogin({ userId: 'user-1', ipAddress: '1.2.3.4' });
      expect(result.riskScore).toBeGreaterThanOrEqual(40);
    });

    it('adds 25 points for new country login', async () => {
      geoService.lookup.mockResolvedValue({ ...mockGeo, countryCode: 'DE' });
      repo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      } as any);
      const result = await service.analyzeLogin({ userId: 'user-1', ipAddress: '1.2.3.4' });
      expect(result.riskScore).toBeGreaterThanOrEqual(25);
    });

    it('triggers CHALLENGED when score > 70 and 2FA enabled', async () => {
      geoService.lookup.mockResolvedValue({ ...mockGeo, isProxy: true, isTor: true });
      repo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      } as any);
      const result = await service.analyzeLogin({
        userId: 'user-1',
        ipAddress: '1.2.3.4',
        twoFaEnabled: true,
      });
      expect(result.requiresTwoFa).toBe(true);
      expect(result.action).toBe(LoginAction.CHALLENGED);
    });

    it('caps risk score at 100', async () => {
      geoService.lookup.mockResolvedValue({ ...mockGeo, isProxy: true, isTor: true });
      repo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      } as any);
      repo.find.mockResolvedValue([
        makeAttempt({ ipAddress: '2.2.2.2' }),
        makeAttempt({ ipAddress: '3.3.3.3' }),
      ]);
      const result = await service.analyzeLogin({ userId: 'user-1', ipAddress: '4.4.4.4' });
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });

  // ─── IP block management ──────────────────────────────────────────────────

  describe('blockIP / unblockIP / getBlockedIPs', () => {
    it('calls sadd on blockIP', async () => {
      await service.blockIP('9.9.9.9');
      expect(redisMock.sadd).toHaveBeenCalledWith('fraud:blocked-ips', '9.9.9.9');
    });

    it('calls srem on unblockIP', async () => {
      await service.unblockIP('9.9.9.9');
      expect(redisMock.srem).toHaveBeenCalledWith('fraud:blocked-ips', '9.9.9.9');
    });

    it('returns members from getBlockedIPs', async () => {
      redisMock.smembers.mockResolvedValue(['1.1.1.1', '2.2.2.2']);
      const ips = await service.getBlockedIPs();
      expect(ips).toEqual(['1.1.1.1', '2.2.2.2']);
    });
  });

  // ─── getLoginHistory ──────────────────────────────────────────────────────

  describe('getLoginHistory', () => {
    it('returns attempts for a user ordered by createdAt DESC', async () => {
      const attempts = [makeAttempt(), makeAttempt({ id: 'attempt-2' })];
      repo.find.mockResolvedValue(attempts);
      const result = await service.getLoginHistory('user-1', 10);
      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' }, take: 10 }),
      );
    });
  });

  // ─── rapid IP switch detection ────────────────────────────────────────────

  describe('rapid IP switch', () => {
    it('adds 20 points when 3+ distinct IPs in window', async () => {
      geoService.lookup.mockResolvedValue(mockGeo);
      repo.create.mockImplementation((d) => d as LoginAttempt);
      repo.save.mockImplementation(async (d) => d as LoginAttempt);
      repo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ countryCode: 'US' }]),
      } as any);
      repo.find.mockResolvedValue([
        makeAttempt({ ipAddress: '10.0.0.1' }),
        makeAttempt({ ipAddress: '10.0.0.2' }),
      ]);
      const result = await service.analyzeLogin({ userId: 'user-1', ipAddress: '10.0.0.3' });
      expect(result.riskScore).toBeGreaterThanOrEqual(20);
    });
  });
});
