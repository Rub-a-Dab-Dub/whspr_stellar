import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WalletNetwork } from '../wallets/entities/wallet.entity';
import { SavedAddressesService } from './saved-addresses.service';
import { SavedAddressesRepository } from './saved-addresses.repository';

describe('SavedAddressesService', () => {
  let service: SavedAddressesService;
  let repository: jest.Mocked<SavedAddressesRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedAddressesService,
        {
          provide: SavedAddressesRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            findByUserId: jest.fn(),
            searchByUser: jest.fn(),
            searchForSuggestions: jest.fn(),
            findByUserAndId: jest.fn(),
            findByAliasCaseInsensitive: jest.fn(),
            findByAddressCaseInsensitive: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SavedAddressesService);
    repository = module.get(SavedAddressesRepository);
  });

  it('adds a valid saved address', async () => {
    repository.findByAliasCaseInsensitive.mockResolvedValue(null);
    repository.findByAddressCaseInsensitive.mockResolvedValue(null);
    repository.create.mockReturnValue({ id: 'sa1' } as any);
    repository.save.mockResolvedValue({ id: 'sa1', alias: 'Mom' } as any);

    const result = await service.addAddress('user1', {
      walletAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      alias: 'Mom',
      network: WalletNetwork.STELLAR_MAINNET,
      tags: ['family'],
    });

    expect(result.id).toBe('sa1');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        alias: 'Mom',
      }),
    );
  });

  it('rejects invalid stellar address format', async () => {
    await expect(
      service.addAddress('user1', {
        walletAddress: 'bad-address',
        alias: 'Mom',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces alias uniqueness case-insensitively', async () => {
    repository.findByAliasCaseInsensitive.mockResolvedValue({ id: 'existing' } as any);

    await expect(
      service.addAddress('user1', {
        walletAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        alias: 'mom',
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates saved address fields', async () => {
    repository.findByUserAndId.mockResolvedValue({
      id: 'sa1',
      userId: 'user1',
      alias: 'Old',
      avatarUrl: null,
      network: WalletNetwork.STELLAR_MAINNET,
      tags: [],
      usageCount: 0,
      lastUsedAt: null,
    } as any);
    repository.findByAliasCaseInsensitive.mockResolvedValue(null);
    repository.save.mockImplementation(async (v: any) => v);

    const result = await service.updateAddress('user1', 'sa1', {
      alias: 'New Alias',
      tags: ['Friends', 'vip'],
    });

    expect(result.alias).toBe('New Alias');
    expect(result.tags).toEqual(['friends', 'vip']);
  });

  it('deletes existing saved address', async () => {
    repository.findByUserAndId.mockResolvedValue({ id: 'sa1' } as any);

    await service.deleteAddress('user1', 'sa1');

    expect(repository.remove).toHaveBeenCalled();
  });

  it('throws on delete when address does not exist', async () => {
    repository.findByUserAndId.mockResolvedValue(null);

    await expect(service.deleteAddress('user1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('searches in default mode by alias/address/tag', async () => {
    repository.searchByUser.mockResolvedValue([{ id: 'sa1' } as any]);

    const results = await service.searchAddresses('user1', { q: 'mom', tag: 'family' });

    expect(results).toHaveLength(1);
    expect(repository.searchByUser).toHaveBeenCalledWith('user1', 'mom', 'family');
  });

  it('returns suggestions sorted by usage in suggest mode', async () => {
    repository.searchForSuggestions.mockResolvedValue([{ id: 'sa2', usageCount: 10 } as any]);

    const results = await service.searchAddresses('user1', { q: 'ga', suggest: true });

    expect(results[0].id).toBe('sa2');
    expect(repository.searchForSuggestions).toHaveBeenCalledWith('user1', 'ga');
  });

  it('tracks usage by saved address id', async () => {
    repository.findByUserAndId.mockResolvedValue({
      id: 'sa1',
      usageCount: 2,
      lastUsedAt: null,
    } as any);
    repository.save.mockImplementation(async (v: any) => v);

    await service.trackUsage('user1', 'sa1');

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ usageCount: 3 }),
    );
  });

  it('tracks usage by wallet address when transaction confirms', async () => {
    repository.findByAddressCaseInsensitive.mockResolvedValue({
      id: 'sa1',
      usageCount: 5,
      lastUsedAt: null,
    } as any);
    repository.save.mockImplementation(async (v: any) => v);

    await service.trackUsageByWalletAddress(
      'user1',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ usageCount: 6 }),
    );
  });
});
