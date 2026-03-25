import { Test, TestingModule } from '@nestjs/testing';
import { NFTsController } from '../src/nfts/nfts.controller';
import { QueryUserNFTsDto } from '../src/nfts/dto/query-user-nfts.dto';
import { NFTsService } from '../src/nfts/nfts.service';

describe('NFTsController', () => {
  let controller: NFTsController;
  let moduleRef: TestingModule;
  let nftsService: jest.Mocked<NFTsService>;

  const nftId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [NFTsController],
      providers: [
        {
          provide: NFTsService,
          useValue: {
            getUserNFTs: jest.fn(),
            syncUserNFTs: jest.fn(),
            getNFT: jest.fn(),
            useAsAvatar: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(NFTsController);
    nftsService = moduleRef.get(NFTsService) as jest.Mocked<NFTsService>;
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('getUserNFTs should return the authenticated user NFTs', async () => {
    nftsService.getUserNFTs.mockResolvedValue([
      { id: nftId, tokenId: 'ART1' },
    ] as any);

    const query: QueryUserNFTsDto = {
      collection: 'issuer.example',
    };

    await expect(controller.getUserNFTs('user-1', query)).resolves.toEqual([
      { id: nftId, tokenId: 'ART1' },
    ]);
    expect(nftsService.getUserNFTs).toHaveBeenCalledWith('user-1', {
      collection: 'issuer.example',
    });
  });

  it('syncUserNFTs should wrap the sync response', async () => {
    nftsService.syncUserNFTs.mockResolvedValue([
      { id: nftId, tokenId: 'ART1' },
    ] as any);

    await expect(controller.syncUserNFTs('user-1')).resolves.toEqual({
      success: true,
      count: 1,
      data: [{ id: nftId, tokenId: 'ART1' }],
    });
  });

  it('getNFT should return a single NFT', async () => {
    nftsService.getNFT.mockResolvedValue({
      id: nftId,
      tokenId: 'ART1',
    } as any);

    await expect(controller.getNFT('user-1', nftId)).resolves.toEqual({
      id: nftId,
      tokenId: 'ART1',
    });
    expect(nftsService.getNFT).toHaveBeenCalledWith(nftId, 'user-1');
  });

  it('useAsAvatar should return the new avatar URL', async () => {
    nftsService.useAsAvatar.mockResolvedValue({
      avatarUrl: 'https://cdn.example.com/art1.png',
    } as any);

    await expect(controller.useAsAvatar('user-1', nftId)).resolves.toEqual({
      success: true,
      nftId,
      avatarUrl: 'https://cdn.example.com/art1.png',
    });
  });

  it('getUserNFTs should trigger a sync when refresh=true is supplied', async () => {
    nftsService.syncUserNFTs.mockResolvedValue([] as any);
    nftsService.getUserNFTs.mockResolvedValue([] as any);

    await expect(
      controller.getUserNFTs('user-1', { refresh: 'true' }),
    ).resolves.toEqual([]);

    expect(nftsService.syncUserNFTs).toHaveBeenCalledWith('user-1');
    expect(nftsService.getUserNFTs).toHaveBeenCalledWith('user-1', {});
  });
});
