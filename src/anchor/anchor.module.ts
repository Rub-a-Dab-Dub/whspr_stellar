import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Anchor } from './entities/anchor.entity';
import { AnchorTransaction } from './entities/anchor-transaction.entity';
import { AnchorService } from './anchor.service';
import { AnchorController } from './anchor.controller';
import { AnchorPollingService } from './anchor-polling.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Anchor, AnchorTransaction]),
    HttpModule,
    CacheModule,
  ],
  controllers: [AnchorController],
  providers: [AnchorService, AnchorPollingService],
  exports: [AnchorService],
})
export class AnchorModule {}
