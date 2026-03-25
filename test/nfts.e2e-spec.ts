import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { NFTsController } from '../src/nfts/nfts.controller';
import { NFTsService } from '../src/nfts/nfts.service';

describe('NFTsController (e2e)', () => {
  let app: INestApplication<App>;
  let nftsService: jest.Mocked<NFTsService>;

  const nftId = '11111111-1111-1111-1111-111111111111';
  const guard: CanActivate = {
    canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest();
      request.user = {
        userId: 'user-1',
      };
      return true;
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
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
        {
          provide: JwtAuthGuard,
          useValue: guard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    nftsService = moduleFixture.get(NFTsService) as jest.Mocked<NFTsService>;
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /nfts should return the authenticated user NFTs', async () => {
    nftsService.getUserNFTs.mockResolvedValue([
      { id: nftId, tokenId: 'ART1' },
    ] as any);

    await request(app.getHttpServer())
      .get('/nfts?collection=issuer.example')
      .expect(200)
      .expect([{ id: nftId, tokenId: 'ART1' }]);

    expect(nftsService.getUserNFTs).toHaveBeenCalledWith('user-1', {
      collection: 'issuer.example',
    });
  });

  it('POST /nfts/sync should wrap the sync response', async () => {
    nftsService.syncUserNFTs.mockResolvedValue([
      { id: nftId, tokenId: 'ART1' },
    ] as any);

    await request(app.getHttpServer())
      .post('/nfts/sync')
      .expect(200)
      .expect({
        success: true,
        count: 1,
        data: [{ id: nftId, tokenId: 'ART1' }],
      });
  });

  it('GET /nfts/:id should return a single NFT', async () => {
    nftsService.getNFT.mockResolvedValue({
      id: nftId,
      tokenId: 'ART1',
    } as any);

    await request(app.getHttpServer())
      .get(`/nfts/${nftId}`)
      .expect(200)
      .expect({ id: nftId, tokenId: 'ART1' });

    expect(nftsService.getNFT).toHaveBeenCalledWith(nftId, 'user-1');
  });

  it('POST /nfts/:id/use-as-avatar should return the new avatar URL', async () => {
    nftsService.useAsAvatar.mockResolvedValue({
      profile: {
        avatarUrl: 'https://cdn.example.com/art1.png',
      },
    } as any);

    await request(app.getHttpServer())
      .post(`/nfts/${nftId}/use-as-avatar`)
      .expect(200)
      .expect({
        success: true,
        nftId,
        avatarUrl: 'https://cdn.example.com/art1.png',
      });
  });

  it('GET /nfts should trigger a sync when refresh=true is supplied', async () => {
    nftsService.syncUserNFTs.mockResolvedValue([] as any);
    nftsService.getUserNFTs.mockResolvedValue([] as any);

    await request(app.getHttpServer()).get('/nfts?refresh=true').expect(200);

    expect(nftsService.syncUserNFTs).toHaveBeenCalledWith('user-1');
    expect(nftsService.getUserNFTs).toHaveBeenCalledWith('user-1', {});
  });
});
