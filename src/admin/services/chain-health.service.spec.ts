import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { ChainHealthService, ChainHealthResult } from './chain-health.service';
import { ChainHealthRecord } from '../entities/chain-health-record.entity';
import { ChainHealthStatus } from '../enums/chain-health-status.enum';
import { ChainService } from '../../chain/chain.service';
import { RedisService } from '../../redis/redis.service';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';
import { ADMIN_STREAM_EVENTS } from '../gateways/admin-event-stream.gateway';

const mockProvider = {
  getBlock: jest.fn(),
  getBalance: jest.fn(),
};

const mockChainService = {
  getAllChains: jest.fn().mockReturnValue([
    { chain: SupportedChain.BNB },
    { chain: SupportedChain.BASE },
  ]),
  getChainConfig: jest.fn().mockReturnValue({
    rpcUrl: 'https://rpc.example.com',
    name: 'Test Chain',
  }),
  getProvider: jest.fn().mockReturnValue(mockProvider),
};

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'PAYMASTER_ADDRESS') return '0xDeadBeef00000000000000000000000000000001';
    if (key === 'PAYMASTER_BALANCE_WARN_THRESHOLD') return '0.5';
    return undefined;
  }),
};

const mockHealthRepo = {
  find: jest.fn().mockResolvedValue([]),
  save: jest.fn().mockResolvedValue({}),
  create: jest.fn().mockImplementation((d) => d),
  createQueryBuilder: jest.fn().mockReturnValue({
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  }),
};

describe('ChainHealthService', () => {
  let service: ChainHealthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainHealthService,
        { provide: getRepositoryToken(ChainHealthRecord), useValue: mockHealthRepo },
        { provide: ChainService, useValue: mockChainService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ChainHealthService>(ChainHealthService);
  });

  // ─── classifyHealth ───────────────────────────────────────────────────────

  describe('classifyHealth', () => {
    it('returns HEALTHY when latency < 500ms and blockAge < 30s', () => {
      expect(service.classifyHealth(100, 10)).toBe(ChainHealthStatus.HEALTHY);
    });

    it('returns HEALTHY with exactly 0ms latency and 0s blockAge', () => {
      expect(service.classifyHealth(0, 0)).toBe(ChainHealthStatus.HEALTHY);
    });

    it('returns HEALTHY at boundary: latency = 499ms and blockAge = 29s', () => {
      expect(service.classifyHealth(499, 29)).toBe(ChainHealthStatus.HEALTHY);
    });

    it('returns DEGRADED when latency > 500ms (block is fine)', () => {
      expect(service.classifyHealth(501, 5)).toBe(ChainHealthStatus.DEGRADED);
    });

    it('returns DEGRADED when blockAge = 30s (at warn threshold)', () => {
      expect(service.classifyHealth(100, 30)).toBe(ChainHealthStatus.DEGRADED);
    });

    it('returns DEGRADED when blockAge = 120s (at down boundary, exclusive)', () => {
      // blockAge == 120 is still DEGRADED (> 120 → DOWN)
      expect(service.classifyHealth(100, 120)).toBe(ChainHealthStatus.DEGRADED);
    });

    it('returns DEGRADED when both latency and blockAge are in degraded range', () => {
      expect(service.classifyHealth(800, 60)).toBe(ChainHealthStatus.DEGRADED);
    });

    it('returns DOWN when RPC does not respond (latencyMs is null)', () => {
      expect(service.classifyHealth(null, null)).toBe(ChainHealthStatus.DOWN);
    });

    it('returns DOWN when blockAge > 120s', () => {
      expect(service.classifyHealth(50, 121)).toBe(ChainHealthStatus.DOWN);
    });

    it('returns DOWN when blockAge is very stale (no RPC issue)', () => {
      expect(service.classifyHealth(200, 3600)).toBe(ChainHealthStatus.DOWN);
    });

    it('returns DOWN over DEGRADED when blockAge > 120 even if latency is fine', () => {
      expect(service.classifyHealth(100, 200)).toBe(ChainHealthStatus.DOWN);
    });

    it('handles null blockAge with healthy latency → HEALTHY', () => {
      // If block age is unknown but latency is fast, default to healthy
      expect(service.classifyHealth(100, null)).toBe(ChainHealthStatus.HEALTHY);
    });

    it('handles null blockAge with slow latency → DEGRADED', () => {
      expect(service.classifyHealth(700, null)).toBe(ChainHealthStatus.DEGRADED);
    });
  });

  // ─── getCurrentHealth ────────────────────────────────────────────────────

  describe('getCurrentHealth', () => {
    it('returns parsed health results from Redis for each chain', async () => {
      const bnbHealth: ChainHealthResult = {
        chain: SupportedChain.BNB,
        rpcUrl: 'https://bsc.example.com',
        status: ChainHealthStatus.HEALTHY,
        latencyMs: 120,
        blockNumber: 1234,
        blockAge: 5,
        paymasterBalance: '1.200000',
        paymasterBalanceWarning: false,
        lastCheckedAt: new Date().toISOString(),
      };

      mockRedisService.get.mockImplementation((key: string) => {
        if (key.includes(SupportedChain.BNB)) return Promise.resolve(JSON.stringify(bnbHealth));
        return Promise.resolve(null);
      });

      const result = await service.getCurrentHealth();

      expect(result[SupportedChain.BNB]).toEqual(bnbHealth);
      expect(result[SupportedChain.BASE]).toBeNull();
    });

    it('returns null for chains with no Redis entry', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.getCurrentHealth();

      expect(Object.values(result).every((v) => v === null)).toBe(true);
    });
  });

  // ─── getHealthHistory ────────────────────────────────────────────────────

  describe('getHealthHistory', () => {
    it('queries last 24h records without chain filter', async () => {
      const record = {
        id: 'r1',
        chain: SupportedChain.BNB,
        status: ChainHealthStatus.HEALTHY,
        checkedAt: new Date(),
      } as ChainHealthRecord;
      mockHealthRepo.find.mockResolvedValue([record]);

      const result = await service.getHealthHistory();

      expect(result).toEqual([record]);
      expect(mockHealthRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checkedAt: expect.anything(),
          }),
          order: { checkedAt: 'DESC' },
        }),
      );
    });

    it('applies chain filter when provided', async () => {
      mockHealthRepo.find.mockResolvedValue([]);

      await service.getHealthHistory(SupportedChain.BASE);

      expect(mockHealthRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ chain: SupportedChain.BASE }),
        }),
      );
    });
  });

  // ─── checkAllChains (integration via private checkAndPersist) ────────────

  describe('checkAllChains', () => {
    it('persists health records to Redis and DB for each chain', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      mockProvider.getBlock.mockResolvedValue({
        number: 99999,
        timestamp: nowSec - 5, // 5s old block → healthy
      });
      // Balance above threshold (0.5 ETH)
      mockProvider.getBalance.mockResolvedValue(BigInt('1000000000000000000')); // 1 ETH

      await service.checkAllChains();

      // Two chains → two Redis writes
      expect(mockRedisService.set).toHaveBeenCalledTimes(2);
      expect(mockHealthRepo.save).toHaveBeenCalledTimes(2);
      // No security alert because balance > threshold
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('marks chain as DOWN when provider throws', async () => {
      mockProvider.getBlock.mockRejectedValue(new Error('Connection refused'));

      await service.checkAllChains();

      // Should still save records (DOWN status)
      const saveCalls = mockHealthRepo.save.mock.calls;
      expect(saveCalls.length).toBeGreaterThan(0);
      expect(saveCalls[0][0]).toEqual(
        expect.objectContaining({ status: ChainHealthStatus.DOWN, latencyMs: null }),
      );
    });

    it('emits SECURITY_ALERT when paymaster balance falls below threshold', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      mockProvider.getBlock.mockResolvedValue({
        number: 12345,
        timestamp: nowSec - 3,
      });
      // Balance below 0.5 ETH threshold → 0.1 ETH
      mockProvider.getBalance.mockResolvedValue(BigInt('100000000000000000'));

      await service.checkAllChains();

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        ADMIN_STREAM_EVENTS.SECURITY_ALERT,
        expect.objectContaining({
          type: 'security.alert',
          entity: expect.objectContaining({
            alertType: 'low_paymaster_balance',
          }),
        }),
      );
    });

    it('sets paymasterBalanceWarning: true on DB record when balance is low', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      mockProvider.getBlock.mockResolvedValue({ number: 1, timestamp: nowSec - 2 });
      mockProvider.getBalance.mockResolvedValue(BigInt('50000000000000000')); // 0.05 ETH < 0.5

      await service.checkAllChains();

      expect(mockHealthRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paymasterBalanceWarning: true }),
      );
    });
  });
});
