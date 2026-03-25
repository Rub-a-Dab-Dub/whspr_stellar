import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { NFTsService } from '../nfts.service';

@Injectable()
export class NFTSyncJob {
  private readonly logger = new Logger(NFTSyncJob.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly nftsService: NFTsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  handleScheduledSync(): void {
    this.logger.log('Queueing scheduled Stellar NFT sync');
    void this.syncTrackedWallets();
  }

  private async syncTrackedWallets(): Promise<void> {
    try {
      const users = await this.userRepository.find({
        where: {
          walletAddress: Not(IsNull()),
          deletedAt: IsNull(),
        },
        select: ['id', 'walletAddress'],
      });

      const results = await Promise.allSettled(
        users.map((user) => this.nftsService.syncUserNFTs(user.id)),
      );

      const failed = results.filter(
        (result) => result.status === 'rejected',
      ).length;

      this.logger.log(
        `Scheduled Stellar NFT sync finished for ${users.length} users (${failed} failed)`,
      );
    } catch (error) {
      this.logger.error('Scheduled Stellar NFT sync failed', error.stack);
    }
  }
}
