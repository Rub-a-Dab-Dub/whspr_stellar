import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioSnapshotRepository } from './portfolio-snapshot.repository';
import { PortfolioSnapshot } from './entities/portfolio-snapshot.entity';
import { WalletsModule } from '../wallets/wallets.module';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PortfolioSnapshot]),
    ScheduleModule.forRoot(),
    CacheModule.register(),
    WalletsModule,
    TokensModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioSnapshotRepository],
  exports: [PortfolioService],
})
export class PortfolioModule {}

