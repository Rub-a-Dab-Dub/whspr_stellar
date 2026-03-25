import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Wallet, WalletNetwork } from '../wallets/entities/wallet.entity';
import { NFT } from './entities/nft.entity';
import { NFTsRepository } from './repositories/nfts.repository';
import { NFTsService } from './nfts.service';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => mockRedis),
);

const mockServersByUrl = new Map<string, any>();

jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn((url: string) => mockServersByUrl.get(url)),
  },
  Asset: jest.fn((code: string, issuer: string) => ({
    code,
    issuer,
  })),
}));

describe('NFTsService', () => {
  let service: NFTsService;
  let moduleRef: TestingModule;
  let nftsRepository: jest.Mocked<NFTsRepository>;
  let userRepository: jest.Mocked<any>;
  let walletRepository: jest.Mocked<any>;
  let mainnetServer: any;
  let testnetServer: any;

  beforeEach(async () => {
    mainnetServer = {
      loadAccount: jest.fn(),
      assets: jest.fn(),
      accounts: jest.fn(),
    };
    testnetServer = {
      loadAccount: jest.fn(),
      assets: jest.fn(),
      accounts: jest.fn(),
    };

    mockServersByUrl.clear();
    mockServersByUrl.set('https://horizon.stellar.org', mainnetServer);
    mockServersByUrl.set('https://horizon-testnet.stellar.org', testnetServer);

    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
    mockRedis.disconnect.mockReset();

    moduleRef = await Test.createTestingModule({
      providers: [
        NFTsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'STELLAR_HORIZON_MAINNET_URL') {
                return 'https://horizon.stellar.org';
              }

              if (key === 'STELLAR_HORIZON_TESTNET_URL') {
                return 'https://horizon-testnet.stellar.org';
              }

              return defaultValue;
            }),
          },
        },
        {
          provide: NFTsRepository,
          useValue: {
            create: jest.fn((payload: NFT) => payload),
            save: jest.fn(),
            remove: jest.fn(),
            findByAsset: jest.fn(),
            findByOwnerId: jest.fn(),
            findOwnedById: jest.fn(),
            findOneById: jest.fn(),
            findForGating: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(NFTsService);
    nftsRepository = moduleRef.get(NFTsRepository) as jest.Mocked<NFTsRepository>;
    userRepository = moduleRef.get(getRepositoryToken(User)) as jest.Mocked<any>;
    walletRepository = moduleRef.get(getRepositoryToken(Wallet)) as jest.Mocked<any>;
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('syncUserNFTs should persist discovered Stellar NFTs and evict stale ones', async () => {
    const wallet: Wallet = {
      id: 'wallet-1',
      userId: 'user-1',
      walletAddress: 'GUSER',
      network: WalletNetwork.STELLAR_MAINNET,
      isVerified: true,
      isPrimary: true,
      label: null,
      createdAt: new Date(),
      user: null as any,
    };
    const staleNFT = {
      id: 'stale-id',
      contractAddress: 'GSTALE',
      tokenId: 'OLDNFT',
      network: WalletNetwork.STELLAR_MAINNET,
    } as NFT;
    const syncedNFT = {
      id: 'nft-1',
      contractAddress: 'GISSUER',
      tokenId: 'ART1',
      ownerId: 'user-1',
      imageUrl: 'data:image/svg+xml,abc',
      name: 'ART1',
      collection: 'issuer.example',
      network: WalletNetwork.STELLAR_MAINNET,
    } as NFT;

    userRepository.findOne.mockResolvedValue({ id: 'user-1' });
    walletRepository.findOne
      .mockResolvedValueOnce(wallet)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockRedis.get.mockResolvedValue(null);
    nftsRepository.findByAsset.mockResolvedValue(null);
    (nftsRepository.save as jest.Mock).mockResolvedValue([syncedNFT]);
    nftsRepository.findByOwnerId
      .mockResolvedValueOnce([staleNFT])
      .mockResolvedValueOnce([syncedNFT]);
    (nftsRepository.remove as jest.Mock).mockResolvedValue([staleNFT]);

    mainnetServer.loadAccount
      .mockResolvedValueOnce({
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'ART1',
            asset_issuer: 'GISSUER',
            balance: '1.0000000',
            limit: '1.0000000',
            is_authorized: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        home_domain: 'issuer.example',
      });
    mainnetServer.assets.mockReturnValue({
      forCode: jest.fn(() => ({
        forIssuer: jest.fn(() => ({
          limit: jest.fn(() => ({
            call: jest.fn().mockResolvedValue({
              records: [
                {
                  asset_type: 'credit_alphanum4',
                  asset_code: 'ART1',
                  asset_issuer: 'GISSUER',
                  amount: '1.0000000',
                  num_accounts: 1,
                },
              ],
            }),
          })),
        })),
      })),
    });

    const result = await service.syncUserNFTs('user-1');

    expect(result).toEqual([syncedNFT]);
    expect(nftsRepository.save).toHaveBeenCalledTimes(1);
    expect(nftsRepository.remove).toHaveBeenCalledWith([staleNFT]);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'nfts:metadata:stellar_mainnet:GISSUER:ART1',
      expect.any(String),
      'EX',
      300,
    );
  });

  it('syncUserNFTs should reject users without a linked Stellar wallet', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1' });
    walletRepository.findOne.mockResolvedValue(null);

    await expect(service.syncUserNFTs('user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getNFT should throw when the NFT is missing', async () => {
    nftsRepository.findOwnedById.mockResolvedValue(null);

    await expect(service.getNFT('missing-nft', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('useAsAvatar should verify ownership and persist the NFT image on the user', async () => {
    const nftId = '11111111-1111-1111-1111-111111111111';
    const wallet: Wallet = {
      id: 'wallet-1',
      userId: 'user-1',
      walletAddress: 'GUSER',
      network: WalletNetwork.STELLAR_MAINNET,
      isVerified: true,
      isPrimary: true,
      label: null,
      createdAt: new Date(),
      user: null as any,
    };

    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      avatarUrl: null,
    });
    userRepository.save.mockImplementation(async (user: User) => user);
    walletRepository.findOne
      .mockResolvedValueOnce(wallet)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    nftsRepository.findOwnedById.mockResolvedValue({
      id: nftId,
      contractAddress: 'GISSUER',
      tokenId: 'ART1',
      imageUrl: 'https://cdn.example.com/art1.png',
      network: WalletNetwork.STELLAR_MAINNET,
    } as NFT);
    mainnetServer.accounts.mockReturnValue({
      forAsset: jest.fn(() => ({
        call: jest.fn().mockResolvedValue({
          records: [{ account_id: 'GUSER' }],
        }),
      })),
    });

    const result = await service.useAsAvatar('user-1', nftId);

    expect(result.avatarUrl).toBe('https://cdn.example.com/art1.png');
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: 'https://cdn.example.com/art1.png',
      }),
    );
  });

  it('getNFTsForGating should force a sync before filtering stored NFTs', async () => {
    const syncedNFT = {
      id: 'nft-1',
      contractAddress: 'GISSUER',
      tokenId: 'ART1',
      network: WalletNetwork.STELLAR_MAINNET,
    } as NFT;

    jest.spyOn(service, 'syncUserNFTs').mockResolvedValue([syncedNFT]);
    nftsRepository.findForGating.mockResolvedValue([syncedNFT]);

    const result = await service.getNFTsForGating('user-1', {
      contractAddress: 'GISSUER',
    });

    expect(service.syncUserNFTs).toHaveBeenCalledWith('user-1');
    expect(nftsRepository.findForGating).toHaveBeenCalledWith('user-1', {
      contractAddress: 'GISSUER',
    });
    expect(result).toEqual([syncedNFT]);
  });

  it('verifyOwnership should return false when Horizon cannot find holders', async () => {
    mainnetServer.accounts.mockReturnValue({
      forAsset: jest.fn(() => ({
        call: jest.fn().mockRejectedValue({
          response: { status: 404 },
        }),
      })),
    });

    await expect(
      service.verifyOwnership(
        'GUSER',
        'GISSUER',
        'ART1',
        WalletNetwork.STELLAR_MAINNET,
      ),
    ).resolves.toBe(false);
  });
});
