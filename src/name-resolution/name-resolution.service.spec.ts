import { of, throwError } from 'rxjs';
import { Keypair } from '@stellar/stellar-sdk';
import { NameResolutionService } from './name-resolution.service';
import { CACHE_MISS_MARKER } from './name-resolution.types';
import { User } from '../users/entities/user.entity';

describe('NameResolutionService', () => {
  let service: NameResolutionService;
  let http: { get: jest.Mock };
  let cache: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    invalidatePattern: jest.Mock;
  };
  let users: {
    findByUsernameCaseInsensitive: jest.Mock;
    findByWalletCaseInsensitive: jest.Mock;
  };
  let registry: { getWalletAddressForUsername: jest.Mock };
  let config: { get: jest.Mock };

  const gAddr = Keypair.random().publicKey();

  beforeEach(() => {
    http = { get: jest.fn() };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    };
    users = {
      findByUsernameCaseInsensitive: jest.fn(),
      findByWalletCaseInsensitive: jest.fn(),
    };
    registry = { getWalletAddressForUsername: jest.fn() };
    config = { get: jest.fn().mockReturnValue('') };

    service = new NameResolutionService(
      http as any,
      cache as any,
      users as any,
      registry as any,
      config as any,
    );
  });

  describe('resolveFederation', () => {
    it('follows SEP-2: stellar.toml then federation JSON', async () => {
      http.get
        .mockReturnValueOnce(
          of({ data: 'FEDERATION_SERVER="https://fed.example.com/v1"\n', status: 200 }),
        )
        .mockReturnValueOnce(
          of({
            data: { stellar_address: gAddr, memo_type: 'text', memo: 'm' },
            status: 200,
          }),
        );

      const out = await service.resolveFederation(`bob*example.com`);
      expect(out).toEqual({
        name: 'bob*example.com',
        type: 'federation',
        stellarAddress: gAddr,
        memoType: 'text',
        memo: 'm',
      });
      expect(http.get).toHaveBeenCalled();
    });

    it('returns null when federation server missing in toml', async () => {
      http.get.mockReturnValueOnce(of({ data: 'VERSION=1\n', status: 200 }));
      await expect(service.resolveFederation('x*y.com')).resolves.toBeNull();
    });

    it('returns null on HTTP error', async () => {
      http.get.mockReturnValueOnce(throwError(() => new Error('network')));
      await expect(service.resolveFederation('a*b.com')).resolves.toBeNull();
    });
  });

  describe('resolveSNS', () => {
    it('returns null when SNS_RESOLVER_BASE_URL unset', async () => {
      await expect(service.resolveSNS('foo.xlm')).resolves.toBeNull();
    });

    it('returns null on SNS HTTP failure', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'SNS_RESOLVER_BASE_URL' ? 'https://sns.test' : '',
      );
      http.get.mockReturnValueOnce(throwError(() => new Error('down')));
      await expect(service.resolveSNS('bad.xlm')).resolves.toBeNull();
    });

    it('resolves via HTTP when base URL set', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'SNS_RESOLVER_BASE_URL' ? 'https://sns.test' : '',
      );
      http.get.mockReturnValueOnce(of({ data: { stellar_address: gAddr }, status: 200 }));
      const out = await service.resolveSNS('myname.xlm');
      expect(out?.stellarAddress).toBe(gAddr);
      expect(out?.type).toBe('sns');
    });
  });

  describe('resolveUsername', () => {
    it('uses Gasless DB user when present', async () => {
      const u = { username: 'alice', walletAddress: gAddr } as User;
      users.findByUsernameCaseInsensitive.mockResolvedValue(u);
      const out = await service.resolveUsername('@alice');
      expect(out).toEqual({ name: '@alice', type: 'native', stellarAddress: gAddr });
    });

    it('falls back to on-chain registry', async () => {
      users.findByUsernameCaseInsensitive.mockResolvedValue(null);
      registry.getWalletAddressForUsername.mockResolvedValue(gAddr);
      const out = await service.resolveUsername('bob');
      expect(out?.stellarAddress).toBe(gAddr);
      expect(registry.getWalletAddressForUsername).toHaveBeenCalledWith('bob');
    });
  });

  describe('resolveAny', () => {
    it('routes user*domain to federation', async () => {
      cache.get.mockResolvedValue(null);
      http.get
        .mockReturnValueOnce(of({ data: 'FEDERATION_SERVER="https://f.test"\n' }))
        .mockReturnValueOnce(of({ data: { stellar_address: gAddr } }));
      const out = await service.resolveAny('me*stellar.org');
      expect(out?.type).toBe('federation');
      expect(out?.stellarAddress).toBe(gAddr);
    });

    it('returns null immediately on cached negative entry', async () => {
      cache.get.mockResolvedValue(CACHE_MISS_MARKER);
      const out = await service.resolveAny('ghost');
      expect(out).toBeNull();
      expect(users.findByUsernameCaseInsensitive).not.toHaveBeenCalled();
    });

    it('returns passthrough for valid StrKey', async () => {
      const out = await service.resolveAny(gAddr);
      expect(out).toEqual({ name: gAddr, type: 'native', stellarAddress: gAddr });
      expect(cache.set).toHaveBeenCalled();
    });

    it('routes @ to native', async () => {
      users.findByUsernameCaseInsensitive.mockResolvedValue({
        username: 'z',
        walletAddress: gAddr,
      } as User);
      await service.resolveAny('@z');
      expect(users.findByUsernameCaseInsensitive).toHaveBeenCalledWith('z');
    });

    it('uses cache hit without calling users', async () => {
      const hit = { name: '@z', type: 'native' as const, stellarAddress: gAddr };
      cache.get.mockResolvedValueOnce(hit);
      await service.resolveAny('@cached');
      expect(users.findByUsernameCaseInsensitive).not.toHaveBeenCalled();
    });

    it('stores miss marker on failure', async () => {
      users.findByUsernameCaseInsensitive.mockResolvedValue(null);
      registry.getWalletAddressForUsername.mockResolvedValue(null);
      await service.resolveAny('nobody12345');
      expect(cache.set).toHaveBeenCalledWith(
        expect.any(String),
        CACHE_MISS_MARKER,
        30,
      );
    });
  });

  describe('reverseResolve', () => {
    it('returns cached primary name', async () => {
      cache.get.mockResolvedValueOnce('@cached');
      const out = await service.reverseResolve(gAddr);
      expect(out).toBe('@cached');
      expect(users.findByWalletCaseInsensitive).not.toHaveBeenCalled();
    });

    it('returns @username from wallet', async () => {
      users.findByWalletCaseInsensitive.mockResolvedValue({
        username: 'pat',
        walletAddress: gAddr,
      } as User);
      const out = await service.reverseResolve(gAddr);
      expect(out).toBe('@pat');
    });

    it('returns null for invalid address', async () => {
      await expect(service.reverseResolve('not-a-key')).resolves.toBeNull();
    });
  });

  describe('resolveBatch', () => {
    it('returns partial nulls', async () => {
      users.findByUsernameCaseInsensitive.mockResolvedValue(null);
      registry.getWalletAddressForUsername.mockResolvedValue(null);
      const out = await service.resolveBatch(['a', 'b']);
      expect(out).toEqual([null, null]);
    });

    it('caps at 50 entries', async () => {
      const spy = jest.spyOn(service, 'resolveAny');
      spy.mockResolvedValue(null);
      const names = Array.from({ length: 60 }, (_, i) => `u${i}`);
      await service.resolveBatch(names);
      expect(spy).toHaveBeenCalledTimes(50);
      spy.mockRestore();
    });
  });

  describe('cacheResolution / invalidateCache', () => {
    it('cacheResolution stores success', async () => {
      const r = { name: 'x', type: 'native' as const, stellarAddress: gAddr };
      await service.cacheResolution('x', r);
      expect(cache.set).toHaveBeenCalledWith(expect.any(String), r, 300);
    });

    it('invalidateCache deletes one key', async () => {
      await service.invalidateCache('Hello');
      expect(cache.del).toHaveBeenCalledWith(`${'name-resolve:v1'}:fwd:hello`);
    });

    it('invalidateCache all uses pattern', async () => {
      await service.invalidateCache();
      expect(cache.invalidatePattern).toHaveBeenCalledWith('name-resolve:v1:*');
    });
  });
});
