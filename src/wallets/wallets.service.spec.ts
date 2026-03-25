import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WalletsService } from './wallets.service';
import { WalletsRepository } from './wallets.repository';
import { HorizonService } from './services/horizon.service';
import { CryptoService } from '../auth/services/crypto.service';
import { Wallet, WalletNetwork } from './entities/wallet.entity';
import { AddWalletDto } from './dto/add-wallet.dto';
import { TranslationService } from '../i18n/services/translation.service';

const USER_ID = 'user-uuid-1';
const WALLET_ID = 'wallet-uuid-1';
const ADDRESS = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';

const makeWallet = (overrides: Partial<Wallet> = {}): Wallet =>
  ({
    id: WALLET_ID,
    userId: USER_ID,
    walletAddress: ADDRESS,
    network: WalletNetwork.STELLAR_MAINNET,
    isVerified: false,
    isPrimary: false,
    label: null,
    createdAt: new Date('2024-01-01'),
    user: {} as any,
    ...overrides,
  } as Wallet);

describe('WalletsService', () => {
  let service: WalletsService;
  let repo: jest.Mocked<WalletsRepository>;
  let horizon: jest.Mocked<HorizonService>;
  let crypto: jest.Mocked<CryptoService>;
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: WalletsRepository,
          useValue: {
            findByUserId: jest.fn(),
            findByUserAndId: jest.fn(),
            findByUserAndAddress: jest.fn(),
            findPrimaryByUserId: jest.fn(),
            countByUserId: jest.fn(),
            transferPrimary: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: HorizonService,
          useValue: {
            isValidAddress: jest.fn().mockReturnValue(true),
            getBalances: jest.fn(),
            buildVerificationMessage: jest.fn().mockReturnValue('verify-msg'),
          },
        },
        {
          provide: CryptoService,
          useValue: { verifyStellarSignature: jest.fn() },
        },
        {
          provide: TranslationService,
          useValue: {
            translate: jest.fn((key: string, options?: { args?: Record<string, unknown> }) =>
              options?.args ? `${key}:${JSON.stringify(options.args)}` : key,
            ),
          },
        },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(WalletsService);
    repo = module.get(WalletsRepository);
    horizon = module.get(HorizonService);
    crypto = module.get(CryptoService);

    jest.clearAllMocks();
    cache.get.mockResolvedValue(null);
  });

  // ─── getWalletsByUser ──────────────────────────────────────────────────────

  describe('getWalletsByUser', () => {
    it('returns mapped DTOs for all user wallets', async () => {
      repo.findByUserId.mockResolvedValue([makeWallet(), makeWallet({ id: 'w2' })]);
      const result = await service.getWalletsByUser(USER_ID);
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(USER_ID);
    });

    it('returns empty array when user has no wallets', async () => {
      repo.findByUserId.mockResolvedValue([]);
      expect(await service.getWalletsByUser(USER_ID)).toEqual([]);
    });
  });

  // ─── addWallet ─────────────────────────────────────────────────────────────

  describe('addWallet', () => {
    const dto: AddWalletDto = { walletAddress: ADDRESS };

    beforeEach(() => {
      repo.countByUserId.mockResolvedValue(0);
      repo.findByUserAndAddress.mockResolvedValue(null);
      repo.create.mockReturnValue(makeWallet({ isPrimary: true }));
      repo.save.mockResolvedValue(makeWallet({ isPrimary: true }));
    });

    it('creates wallet and sets isPrimary=true for first wallet', async () => {
      const result = await service.addWallet(USER_ID, dto);
      expect(result.isPrimary).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });

    it('sets isPrimary=false when user already has wallets', async () => {
      repo.countByUserId.mockResolvedValue(2);
      repo.create.mockReturnValue(makeWallet({ isPrimary: false }));
      repo.save.mockResolvedValue(makeWallet({ isPrimary: false }));
      const result = await service.addWallet(USER_ID, dto);
      expect(result.isPrimary).toBe(false);
    });

    it('throws BadRequestException for invalid Stellar address', async () => {
      horizon.isValidAddress.mockReturnValue(false);
      await expect(service.addWallet(USER_ID, dto)).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when wallet cap reached', async () => {
      repo.countByUserId.mockResolvedValue(10);
      await expect(service.addWallet(USER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException for duplicate wallet', async () => {
      repo.findByUserAndAddress.mockResolvedValue(makeWallet());
      await expect(service.addWallet(USER_ID, dto)).rejects.toThrow(ConflictException);
    });

    it('verifies signature when provided and sets isVerified=true', async () => {
      crypto.verifyStellarSignature.mockReturnValue(true);
      repo.create.mockReturnValue(makeWallet({ isVerified: true }));
      repo.save.mockResolvedValue(makeWallet({ isVerified: true }));
      const result = await service.addWallet(USER_ID, { ...dto, signature: 'valid-sig' });
      expect(result.isVerified).toBe(true);
      expect(crypto.verifyStellarSignature).toHaveBeenCalledWith(ADDRESS, 'verify-msg', 'valid-sig');
    });

    it('throws UnauthorizedException for bad signature', async () => {
      crypto.verifyStellarSignature.mockReturnValue(false);
      await expect(
        service.addWallet(USER_ID, { ...dto, signature: 'bad-sig' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── removeWallet ──────────────────────────────────────────────────────────

  describe('removeWallet', () => {
    it('removes a non-primary wallet', async () => {
      repo.findByUserAndId.mockResolvedValue(makeWallet({ isPrimary: false }));
      repo.remove.mockResolvedValue(makeWallet());
      await service.removeWallet(USER_ID, WALLET_ID);
      expect(repo.remove).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalled();
    });

    it('removes the only wallet even if it is primary', async () => {
      repo.findByUserAndId.mockResolvedValue(makeWallet({ isPrimary: true }));
      repo.countByUserId.mockResolvedValue(1);
      repo.remove.mockResolvedValue(makeWallet());
      await service.removeWallet(USER_ID, WALLET_ID);
      expect(repo.remove).toHaveBeenCalled();
    });

    it('throws BadRequestException when removing primary with siblings', async () => {
      repo.findByUserAndId.mockResolvedValue(makeWallet({ isPrimary: true }));
      repo.countByUserId.mockResolvedValue(3);
      await expect(service.removeWallet(USER_ID, WALLET_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown wallet', async () => {
      repo.findByUserAndId.mockResolvedValue(null);
      await expect(service.removeWallet(USER_ID, WALLET_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── setPrimary ────────────────────────────────────────────────────────────

  describe('setPrimary', () => {
    it('transfers primary to the specified wallet', async () => {
      const wallet = makeWallet({ isPrimary: false });
      const updated = makeWallet({ isPrimary: true });
      repo.findByUserAndId
        .mockResolvedValueOnce(wallet)   // first call — existence check
        .mockResolvedValueOnce(updated); // second call — re-fetch after update
      repo.transferPrimary.mockResolvedValue(undefined);

      const result = await service.setPrimary(USER_ID, WALLET_ID);
      expect(result.isPrimary).toBe(true);
      expect(repo.transferPrimary).toHaveBeenCalledWith(USER_ID, WALLET_ID);
    });

    it('is idempotent when wallet is already primary', async () => {
      repo.findByUserAndId.mockResolvedValue(makeWallet({ isPrimary: true }));
      const result = await service.setPrimary(USER_ID, WALLET_ID);
      expect(result.isPrimary).toBe(true);
      expect(repo.transferPrimary).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown wallet', async () => {
      repo.findByUserAndId.mockResolvedValue(null);
      await expect(service.setPrimary(USER_ID, WALLET_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── verifyWallet ──────────────────────────────────────────────────────────

  describe('verifyWallet', () => {
    it('verifies wallet with valid signature', async () => {
      repo.findByUserAndId.mockResolvedValue(makeWallet({ isVerified: false }));
      crypto.verifyStellarSignature.mockReturnValue(true);
      repo.save.mockResolvedValue(makeWallet({ isVerified: true }));

      const result = await service.verifyWallet(USER_ID, WALLET_ID, 'valid-sig');
      expect(result.isVerified).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ isVerified: true }));
    });

    it('is idempotent when already verified', async () => {
      repo.findByUserAndId.mockResolvedValue(makeWallet({ isVerified: true }));
      const result = await service.verifyWallet(USER_ID, WALLET_ID, 'any-sig');
      expect(result.isVerified).toBe(true);
      expect(crypto.verifyStellarSignature).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for invalid signature', async () => {
      repo.findByUserAndId.mockResolvedValue(makeWallet({ isVerified: false }));
      crypto.verifyStellarSignature.mockReturnValue(false);
      await expect(service.verifyWallet(USER_ID, WALLET_ID, 'bad-sig')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws NotFoundException for unknown wallet', async () => {
      repo.findByUserAndId.mockResolvedValue(null);
      await expect(service.verifyWallet(USER_ID, WALLET_ID, 'sig')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getBalance ────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    const mockBalances = [
      {
        assetCode: 'XLM',
        assetType: 'native',
        assetIssuer: null,
        balance: '100.0000000',
        buyingLiabilities: '0.0000000',
        sellingLiabilities: '0.0000000',
      },
    ];

    it('fetches from Horizon and caches result', async () => {
      repo.findByUserAndId.mockResolvedValue(makeWallet());
      horizon.getBalances.mockResolvedValue(mockBalances);

      const result = await service.getBalance(USER_ID, WALLET_ID);

      expect(result.walletAddress).toBe(ADDRESS);
      expect(result.balances).toHaveLength(1);
      expect(result.cached).toBe(false);
      expect(cache.set).toHaveBeenCalled();
    });

    it('returns cached result on subsequent call', async () => {
      const cachedResult = {
        walletAddress: ADDRESS,
        balances: mockBalances,
        fetchedAt: new Date().toISOString(),
        cached: false,
      };
      repo.findByUserAndId.mockResolvedValue(makeWallet());
      cache.get.mockResolvedValue(cachedResult);

      const result = await service.getBalance(USER_ID, WALLET_ID);

      expect(result.cached).toBe(true);
      expect(horizon.getBalances).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown wallet', async () => {
      repo.findByUserAndId.mockResolvedValue(null);
      await expect(service.getBalance(USER_ID, WALLET_ID)).rejects.toThrow(NotFoundException);
    });

    it('propagates Horizon NotFoundException for unfunded account', async () => {
      repo.findByUserAndId.mockResolvedValue(makeWallet());
      horizon.getBalances.mockRejectedValue(new NotFoundException('Account not found'));
      await expect(service.getBalance(USER_ID, WALLET_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
