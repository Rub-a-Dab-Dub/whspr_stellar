import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NFTsService } from '../nfts.service';
import { Wallet, WalletNetwork } from '../../wallets/entities/wallet.entity';

@Injectable()
export class NFTSyncJob {
  private readonly logger = new Logger(NFTSyncJob.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly nftsService: NFTsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  handleScheduledSync(): void {
    this.logger.log('Queueing scheduled Stellar NFT sync');
    void this.syncTrackedWallets();
  }

  private async syncTrackedWallets(): Promise<void> {
    try {
      const wallets = await this.walletRepository.find({
        where: {
          isPrimary: true,
          network: In([
            WalletNetwork.STELLAR_MAINNET,
            WalletNetwork.STELLAR_TESTNET,
          ]),
        },
        select: ['userId', 'walletAddress', 'network'],
      });

      const results = await Promise.allSettled(
        wallets.map((wallet) => this.nftsService.syncUserNFTs(wallet.userId)),
      );

      const failed = results.filter(
        (result) => result.status === 'rejected',
      ).length;

      this.logger.log(
        `Scheduled Stellar NFT sync finished for ${wallets.length} wallets (${failed} failed)`,
      );
    } catch (error) {
      this.logger.error(
        'Scheduled Stellar NFT sync failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
