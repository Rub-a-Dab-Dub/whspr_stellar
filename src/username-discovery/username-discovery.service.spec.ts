import { Test, TestingModule } from '@nestjs/testing';
import { TooManyRequestsException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { QrCodeService } from '../qr-code/qr-code.service';
import { RedisService } from '../common/redis/redis.service';
import { UsernameDiscoveryService } from './username-discovery.service';

describe('UsernameDiscoveryService', () => {
  let service: UsernameDiscoveryService;

  const dataSourceMock = {
    query: jest.fn(),
  };

  const cacheServiceMock = {
    getOrSet: jest.fn(),
  };

  const qrCodeServiceMock = {
    generateProfileQR: jest.fn(),
  };

  const redisClientMock = {
    incr: jest.fn(),
    expire: jest.fn(),
  };

  const redisServiceMock = {
    getClient: jest.fn(() => redisClientMock),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsernameDiscoveryService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: CacheService, useValue: cacheServiceMock },
        { provide: QrCodeService, useValue: qrCodeServiceMock },
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    service = module.get(UsernameDiscoveryService);
    jest.clearAllMocks();
    redisClientMock.incr.mockResolvedValue(1);
    redisClientMock.expire.mockResolvedValue(1);
  });

  it('discovers users and maps masked wallet plus ranking fields', async () => {
    dataSourceMock.query
      .mockResolvedValueOnce([{ walletAddress: 'GREQUESTERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }])
      .mockResolvedValueOnce([
        {
          id: 'u-1',
          username: 'alice',
          displayName: 'Alice',
          avatarUrl: 'https://cdn/avatar.png',
          bio: 'hello',
          walletAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          tier: 'silver',
          isVerified: true,
          reputationScore: '4.25',
          mutualContactsCount: '3',
          relevanceScore: '80',
        },
      ]);

    const results = await service.discoverUsers('requester-id', { q: 'ali', limit: 10 });

    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('alice');
    expect(results[0].walletAddressMasked).toMatch(/\.\.\./);
    expect(results[0].mutualContactsCount).toBe(3);
    expect(results[0].reputationScore).toBe(4.25);
  });

  it('returns cached public profile card', async () => {
    cacheServiceMock.getOrSet.mockImplementation(async (_key: string, _ttl: number, cb: () => Promise<any>) => cb());
    dataSourceMock.query
      .mockResolvedValueOnce([{ walletAddress: 'GREQUESTERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }])
      .mockResolvedValueOnce([
        {
          id: 'u-2',
          username: 'bob',
          displayName: 'Bob',
          avatarUrl: null,
          bio: 'bio',
          walletAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
          tier: 'gold',
          isVerified: false,
          reputationScore: '0',
          mutualContactsCount: '0',
          relevanceScore: '100',
        },
      ]);

    const card = await service.getPublicCard('requester-id', 'bob');

    expect(cacheServiceMock.getOrSet).toHaveBeenCalled();
    expect(card.username).toBe('bob');
    expect(card.deepLink).toBe('gasless://profile/bob');
    expect(card.walletAddressMasked).toMatch(/\.\.\./);
  });

  it('delegates profile QR generation to QR service', async () => {
    const png = Buffer.from('png');
    qrCodeServiceMock.generateProfileQR.mockResolvedValue(png);

    const result = await service.getProfileQr('satoshi');

    expect(result).toBe(png);
    expect(qrCodeServiceMock.generateProfileQR).toHaveBeenCalledWith('satoshi');
  });

  it('enforces per-user search rate limit', async () => {
    redisClientMock.incr.mockResolvedValue(31);

    await expect(service.discoverUsers('requester-id', { q: 'al' })).rejects.toThrow(
      TooManyRequestsException,
    );
  });
});
