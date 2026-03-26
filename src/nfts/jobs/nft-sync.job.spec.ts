import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Wallet, WalletNetwork } from '../../wallets/entities/wallet.entity';
import { NFTsService } from '../nfts.service';
import { NFTSyncJob } from './nft-sync.job';

describe('NFTSyncJob', () => {
  let job: NFTSyncJob;
  let moduleRef: TestingModule;
  let walletRepository: jest.Mocked<any>;
  let nftsService: jest.Mocked<NFTsService>;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        NFTSyncJob,
        {
          provide: getRepositoryToken(Wallet),
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

    job = moduleRef.get(NFTSyncJob);
    walletRepository = moduleRef.get(
      getRepositoryToken(Wallet),
    ) as jest.Mocked<any>;
    nftsService = moduleRef.get(NFTsService) as jest.Mocked<NFTsService>;
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('syncTrackedWallets should schedule a sync for every primary Stellar wallet', async () => {
    walletRepository.find.mockResolvedValue([
      {
        userId: 'user-1',
        walletAddress: 'GUSER1',
        network: WalletNetwork.STELLAR_MAINNET,
      },
      {
        userId: 'user-2',
        walletAddress: 'GUSER2',
        network: WalletNetwork.STELLAR_TESTNET,
      },
    ]);
    nftsService.syncUserNFTs.mockResolvedValue([]);

    await (job as any).syncTrackedWallets();

    expect(walletRepository.find).toHaveBeenCalled();
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
