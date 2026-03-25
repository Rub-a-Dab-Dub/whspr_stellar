import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../redis/redis.module';
import { User } from '../user/entities/user.entity';
import { NFT } from './entities/nft.entity';
import { NFTSyncJob } from './jobs/nft-sync.job';
import { NFTsController } from './nfts.controller';
import { NFTsService } from './nfts.service';
import { NFTsRepository } from './repositories/nfts.repository';

@Module({
  imports: [TypeOrmModule.forFeature([NFT, User]), RedisModule, ScheduleModule.forRoot()],
  controllers: [NFTsController],
  providers: [NFTsService, NFTsRepository, NFTSyncJob],
  exports: [NFTsService, NFTsRepository],
})
export class NFTsModule {}
