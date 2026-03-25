import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisService } from '../redis/redis.service';
import { User } from '../user/entities/user.entity';
import { NFT } from './entities/nft.entity';
import { NFTsRepository } from './repositories/nfts.repository';
import { NFTsService } from './nfts.service';

const mockResolver = {
  resolve: jest.fn(),
};

const mockServer = {
  accounts: jest.fn(),
  assets: jest.fn(),
};

const mockAsset = jest
  .fn()
  .mockImplementation((code: string, issuer: string) => ({
    code,
    issuer,
    contractId: jest.fn(() => `contract-${code}-${issuer}`),
    toString: () => `${code}:${issuer}`,
  }));

jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn(() => mockServer),
  },
  Networks: {
    TESTNET: 'TESTNET',
  },
  StellarToml: {
    Resolver: mockResolver,
  },
  Asset: mockAsset,
}));

describe('NFTsService', () => {
  let service: NFTsService;
  let nftsRepository: jest.Mocked<NFTsRepository>;
  let userRepository: jest.Mocked<any>;
  let redisService: jest.Mocked<RedisService>;

  let accountResponses: Record<string, unknown>;
  let assetResponses: Record<string, unknown>;
  let holderResponses: Record<string, unknown>;

  beforeEach(async () => {
    accountResponses = {};
    assetResponses = {};
    holderResponses = {};

    mockServer.accounts.mockImplementation(() => ({
      accountId: jest.fn((accountId: string) => ({
        call: jest.fn().mockResolvedValue(accountResponses[accountId]),
      })),
      forAsset: jest.fn((asset: { code: string; issuer: string }) => ({
        call: jest
          .fn()
          .mockResolvedValue(holderResponses[`${asset.code}:${asset.issuer}`]),
      })),
    }));

    mockServer.assets.mockImplementation(() => ({
      forCode: jest.fn((code: string) => ({
        forIssuer: jest.fn((issuer: string) => ({
          limit: jest.fn(() => ({
            call: jest
              .fn()
              .mockResolvedValue(assetResponses[`${code}:${issuer}`]),
          })),
        })),
      })),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NFTsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STELLAR_HORIZON_URL') {
                return 'https://horizon-testnet.stellar.org';
              }

              if (key === 'STELLAR_NETWORK_PASSPHRASE') {
                return 'TESTNET';
              }

              return undefined;
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
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(NFTsService);
    nftsRepository = module.get(NFTsRepository) as jest.Mocked<NFTsRepository>;
    userRepository = module.get(getRepositoryToken(User)) as jest.Mocked<any>;
    redisService = module.get(RedisService) as jest.Mocked<RedisService>;
    mockResolver.resolve.mockReset();
    mockAsset.mockClear();
  });

  it('syncUserNFTs should persist discovered Stellar NFTs and evict stale ones', async () => {
    const staleNFT = {
      id: 'stale-id',
      contractAddress: 'GSTALE',
      tokenId: 'OLDNFT',
      network: 'stellar',
    } as NFT;
    const syncedNFT = {
      id: 'nft-1',
      contractAddress: 'GISSUER',
      tokenId: 'ART1',
      ownerId: 'user-1',
      imageUrl: 'https://cdn.example.com/art1.png',
      name: 'Genesis Art',
      collection: 'issuer.example',
      network: 'stellar',
    } as NFT;

    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      walletAddress: 'GUSER',
    });
    redisService.get.mockResolvedValue(null);
    nftsRepository.findByAsset.mockResolvedValue(null);
    nftsRepository.save.mockResolvedValue([syncedNFT]);
    nftsRepository.findByOwnerId
      .mockResolvedValueOnce([staleNFT])
      .mockResolvedValueOnce([syncedNFT]);
    nftsRepository.remove.mockResolvedValue([staleNFT]);
    mockResolver.resolve.mockResolvedValue({
      CURRENCIES: [
        {
          code: 'ART1',
          issuer: 'GISSUER',
          name: 'Genesis Art',
          image: 'https://cdn.example.com/art1.png',
        },
      ],
    });

    accountResponses.GUSER = {
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
    };
    accountResponses.GISSUER = {
      home_domain: 'issuer.example',
    };
    assetResponses['ART1:GISSUER'] = {
      records: [
        {
          asset_type: 'credit_alphanum4',
          asset_code: 'ART1',
          asset_issuer: 'GISSUER',
          amount: '1.0000000',
          num_accounts: 1,
        },
      ],
    };

    const result = await service.syncUserNFTs('user-1');

    expect(result).toEqual([syncedNFT]);
    expect(nftsRepository.save).toHaveBeenCalledTimes(1);
    expect(nftsRepository.remove).toHaveBeenCalledWith([staleNFT]);
    expect(redisService.set).toHaveBeenCalledWith(
      'nfts:metadata:stellar:GISSUER:ART1',
      expect.any(String),
      300,
    );
  });

  it('syncUserNFTs should reject users without a Stellar wallet', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      walletAddress: null,
    });

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

  it('useAsAvatar should verify ownership and persist the NFT image on the user profile', async () => {
    const nftId = '11111111-1111-1111-1111-111111111111';

    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      walletAddress: 'GUSER',
      profile: {
        bio: 'bio',
        website: 'https://example.com',
        location: 'Lagos',
      },
    });
    userRepository.save.mockImplementation(async (user: User) => user);
    nftsRepository.findOwnedById.mockResolvedValue({
      id: nftId,
      contractAddress: 'GISSUER',
      tokenId: 'ART1',
      imageUrl: 'https://cdn.example.com/art1.png',
      network: 'stellar',
    } as NFT);
    holderResponses['ART1:GISSUER'] = {
      records: [{ account_id: 'GUSER' }],
    };

    const result = await service.useAsAvatar('user-1', nftId);

    expect(result.profile.avatarUrl).toBe('https://cdn.example.com/art1.png');
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({
          avatarUrl: 'https://cdn.example.com/art1.png',
        }),
      }),
    );
  });

  it('getNFTsForGating should force a sync before filtering stored NFTs', async () => {
    const syncedNFT = {
      id: 'nft-1',
      contractAddress: 'GISSUER',
      tokenId: 'ART1',
      network: 'stellar',
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

  it('verifyOwnership should return false for unsupported networks', async () => {
    await expect(
      service.verifyOwnership('GUSER', 'GISSUER', 'ART1', 'ethereum'),
    ).resolves.toBe(false);
  });
});
