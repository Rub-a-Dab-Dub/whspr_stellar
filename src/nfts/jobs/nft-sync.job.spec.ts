import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../user/entities/user.entity';
import { NFTsService } from '../nfts.service';
import { NFTSyncJob } from './nft-sync.job';

describe('NFTSyncJob', () => {
  let job: NFTSyncJob;
  let userRepository: jest.Mocked<any>;
  let nftsService: jest.Mocked<NFTsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NFTSyncJob,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: NFTsService,
          useValue: {
            syncUserNFTs: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get(NFTSyncJob);
    userRepository = module.get(getRepositoryToken(User)) as jest.Mocked<any>;
    nftsService = module.get(NFTsService) as jest.Mocked<NFTsService>;
  });

  it('syncTrackedWallets should schedule a sync for every tracked wallet', async () => {
    userRepository.find.mockResolvedValue([
      { id: 'user-1', walletAddress: 'GUSER1' },
      { id: 'user-2', walletAddress: 'GUSER2' },
    ]);
    nftsService.syncUserNFTs.mockResolvedValue([]);

    await (job as any).syncTrackedWallets();

    expect(userRepository.find).toHaveBeenCalled();
    expect(nftsService.syncUserNFTs).toHaveBeenCalledTimes(2);
    expect(nftsService.syncUserNFTs).toHaveBeenNthCalledWith(1, 'user-1');
    expect(nftsService.syncUserNFTs).toHaveBeenNthCalledWith(2, 'user-2');
  });

  it('handleScheduledSync should dispatch the background sync without awaiting it', () => {
    const syncSpy = jest
      .spyOn(job as any, 'syncTrackedWallets')
      .mockResolvedValue(undefined);

    job.handleScheduledSync();

    expect(syncSpy).toHaveBeenCalled();
  });
});
