import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Keypair } from '@stellar/stellar-sdk';
import { ContentGatesService } from './content-gates.service';
import {
  ContentGate,
  GatedContentType,
  GateType,
} from './entities/content-gate.entity';
import { User, UserTier } from '../users/entities/user.entity';
import { WalletNetwork } from '../wallets/entities/wallet.entity';
import { ContentGateRequiredException } from './exceptions/content-gate-required.exception';

describe('ContentGatesService', () => {
  let service: ContentGatesService;
  let gateRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let cache: { get: jest.Mock; set: jest.Mock; invalidatePattern: jest.Mock };
  let horizon: { getBalancesOrEmpty: jest.Mock };
  let users: { findOne: jest.Mock };

  const stellar = Keypair.random().publicKey();

  const baseUser: Partial<User> = {
    id: 'user-1',
    walletAddress: stellar,
    tier: UserTier.SILVER,
  };

  beforeEach(() => {
    gateRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'gate-new', ...x })),
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    };
    horizon = { getBalancesOrEmpty: jest.fn() };
    users = { findOne: jest.fn() };

    service = new ContentGatesService(
      gateRepo as any,
      cache as any,
      horizon as any,
      users as any,
    );
  });

  it('createGate rejects invalid staking tier token', async () => {
    await expect(
      service.createGate('user-1', {
        contentType: GatedContentType.MESSAGE,
        contentId: 'c1',
        gateType: GateType.STAKING_TIER,
        gateToken: 'platinum',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gateRepo.save).not.toHaveBeenCalled();
  });

  it('createGate rejects invalid asset token', async () => {
    await expect(
      service.createGate('user-1', {
        contentType: GatedContentType.MESSAGE,
        contentId: 'c1',
        gateType: GateType.FUNGIBLE,
        gateToken: 'not-an-asset',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createGate persists valid fungible gate', async () => {
    gateRepo.save.mockResolvedValue({ id: 'new' });
    await service.createGate('user-1', {
      contentType: GatedContentType.MESSAGE,
      contentId: ' c1 ',
      gateType: GateType.FUNGIBLE,
      gateToken: 'native',
      minBalance: '1',
    } as any);
    expect(gateRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: 'c1',
        gateToken: 'native',
        minBalance: '1',
      }),
    );
  });

  it('getGatedContent returns summaries', async () => {
    gateRepo.find.mockResolvedValue([
      {
        id: 'g1',
        contentType: GatedContentType.CHANNEL,
        contentId: 'ch1',
        gateType: GateType.NFT,
        gateToken: 'ART:GISSUERKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        minBalance: '0',
        network: WalletNetwork.STELLAR_MAINNET,
      },
    ]);
    const rows = await service.getGatedContent(GatedContentType.CHANNEL, 'ch1');
    expect(rows).toEqual([
      expect.objectContaining({ id: 'g1', contentId: 'ch1', gateType: GateType.NFT }),
    ]);
  });

  it('removeGate throws when not owner', async () => {
    gateRepo.findOne.mockResolvedValue({
      id: 'gid',
      createdBy: 'other',
      isActive: true,
    });
    await expect(service.removeGate('gid', 'user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('removeGate throws when missing', async () => {
    gateRepo.findOne.mockResolvedValue(null);
    await expect(service.removeGate('gid', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('verifyAccess allows when no gates', async () => {
    gateRepo.find.mockResolvedValue([]);
    const out = await service.verifyAccess('user-1', GatedContentType.MESSAGE, 'c1');
    expect(out.allowed).toBe(true);
  });

  it('staking tier gate passes when user rank sufficient', async () => {
    const gate: Partial<ContentGate> = {
      id: 'g1',
      contentType: GatedContentType.MESSAGE,
      contentId: 'c1',
      gateType: GateType.STAKING_TIER,
      gateToken: 'silver',
      minBalance: '0',
      network: WalletNetwork.STELLAR_TESTNET,
      isActive: true,
    };
    gateRepo.find.mockResolvedValue([gate]);
    users.findOne.mockResolvedValue({ ...baseUser, tier: UserTier.GOLD });
    const out = await service.verifyAccess('user-1', GatedContentType.MESSAGE, 'c1');
    expect(out.allowed).toBe(true);
    expect(cache.set).toHaveBeenCalled();
  });

  it('staking tier gate fails when rank too low', async () => {
    const gate: Partial<ContentGate> = {
      id: 'g1',
      contentType: GatedContentType.MESSAGE,
      contentId: 'c1',
      gateType: GateType.STAKING_TIER,
      gateToken: 'gold',
      minBalance: '0',
      network: WalletNetwork.STELLAR_TESTNET,
      isActive: true,
    };
    gateRepo.find.mockResolvedValue([gate]);
    users.findOne.mockResolvedValue({ ...baseUser, tier: UserTier.SILVER });
    const out = await service.verifyAccess('user-1', GatedContentType.MESSAGE, 'c1');
    expect(out.allowed).toBe(false);
    expect(out.gates.length).toBe(1);
  });

  it('fungible gate checks Horizon balance', async () => {
    const gate: Partial<ContentGate> = {
      id: 'g2',
      contentType: GatedContentType.FILE,
      contentId: 'f1',
      gateType: GateType.FUNGIBLE,
      gateToken: 'native',
      minBalance: '10',
      network: WalletNetwork.STELLAR_TESTNET,
      isActive: true,
    };
    gateRepo.find.mockResolvedValue([gate]);
    users.findOne.mockResolvedValue(baseUser);
    horizon.getBalancesOrEmpty.mockResolvedValue([
      {
        assetCode: 'XLM',
        assetType: 'native',
        assetIssuer: null,
        balance: '100.0000000',
        buyingLiabilities: '0',
        sellingLiabilities: '0',
      },
    ]);
    const out = await service.verifyAccess('user-1', GatedContentType.FILE, 'f1');
    expect(out.allowed).toBe(true);
  });

  it('NFT gate requires at least 1 balance', async () => {
    const gate: Partial<ContentGate> = {
      id: 'g3',
      contentType: GatedContentType.THREAD,
      contentId: 't1',
      gateType: GateType.NFT,
      gateToken: 'ART:GISSUERKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      minBalance: '0',
      network: WalletNetwork.STELLAR_TESTNET,
      isActive: true,
    };
    gateRepo.find.mockResolvedValue([gate]);
    users.findOne.mockResolvedValue(baseUser);
    horizon.getBalancesOrEmpty.mockResolvedValue([
      {
        assetCode: 'ART',
        assetType: 'credit_alphanum4',
        assetIssuer: 'GISSUERKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        balance: '0.0000000',
        buyingLiabilities: '0',
        sellingLiabilities: '0',
      },
    ]);
    const out = await service.verifyAccess('user-1', GatedContentType.THREAD, 't1');
    expect(out.allowed).toBe(false);
  });

  it('uses cache on second verify', async () => {
    const gate: Partial<ContentGate> = {
      id: 'g1',
      contentType: GatedContentType.MESSAGE,
      contentId: 'c1',
      gateType: GateType.STAKING_TIER,
      gateToken: 'silver',
      minBalance: '0',
      network: WalletNetwork.STELLAR_TESTNET,
      isActive: true,
    };
    gateRepo.find.mockResolvedValue([gate]);
    users.findOne.mockResolvedValue(baseUser);
    cache.get.mockResolvedValueOnce(null).mockResolvedValueOnce({ allowed: true });
    await service.verifyAccess('user-1', GatedContentType.MESSAGE, 'c1');
    await service.verifyAccess('user-1', GatedContentType.MESSAGE, 'c1');
    expect(users.findOne).toHaveBeenCalledTimes(1);
  });

  it('assertAccessOr402 throws 402 with full gate list for content', async () => {
    const gate = {
      id: 'g1',
      contentType: GatedContentType.MESSAGE,
      contentId: 'c1',
      gateType: GateType.STAKING_TIER,
      gateToken: 'black',
      minBalance: '0',
      network: WalletNetwork.STELLAR_TESTNET,
      isActive: true,
    };
    gateRepo.find.mockResolvedValue([gate]);
    users.findOne.mockResolvedValue(baseUser);
    let thrown: unknown;
    try {
      await service.assertAccessOr402('user-1', {
        contentType: GatedContentType.MESSAGE,
        contentId: 'c1',
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ContentGateRequiredException);
    const ex = thrown as ContentGateRequiredException;
    expect(ex.getStatus()).toBe(402);
    expect(ex.getResponse()).toEqual(
      expect.objectContaining({
        gates: expect.arrayContaining([
          expect.objectContaining({ id: 'g1', gateType: GateType.STAKING_TIER, gateToken: 'black' }),
        ]),
      }),
    );
  });

  it('removeGate invalidates cache pattern', async () => {
    gateRepo.findOne.mockResolvedValue({
      id: 'gid',
      createdBy: 'user-1',
      isActive: true,
    });
    gateRepo.save.mockImplementation(async (g) => g);
    await service.removeGate('gid', 'user-1');
    expect(cache.invalidatePattern).toHaveBeenCalledWith('content-gate:v1:gate:gid:user:*');
  });

  it('batchVerify caps items', async () => {
    gateRepo.find.mockResolvedValue([]);
    const items = Array.from({ length: 60 }, (_, i) => ({
      contentType: GatedContentType.MESSAGE,
      contentId: `x${i}`,
    }));
    const out = await service.batchVerify('user-1', items);
    expect(out).toHaveLength(50);
  });

  it('cacheVerification sets redis entry', async () => {
    await service.cacheVerification('g1', 'u1', true);
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('g1'),
      { allowed: true },
      300,
    );
  });
});
