import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { NFT } from './entities/nft.entity';
import { NFTSyncJob } from './jobs/nft-sync.job';
import { NFTsController } from './nfts.controller';
import { NFTsService } from './nfts.service';
import { NFTsRepository } from './repositories/nfts.repository';

@Module({
  imports: [TypeOrmModule.forFeature([NFT, User, Wallet])],
  controllers: [NFTsController],
  providers: [NFTsService, NFTsRepository, NFTSyncJob],
  exports: [NFTsService, NFTsRepository],
})
export class NFTsModule {}
