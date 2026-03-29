import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrustNetworkController } from './trust-network.controller';
import { TrustNetworkService } from './trust-network.service';
import { TrustNetworkRepository } from './trust-network.repository';
import { Vouch } from './entities/vouch.entity';
import { TrustScore } from './entities/trust-score.entity';
import { SorobanModule } from '../soroban/soroban.module';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vouch, TrustScore]),
    SorobanModule,
    ReputationModule,
  ],
  controllers: [TrustNetworkController],
  providers: [TrustNetworkService, TrustNetworkRepository],
  exports: [TrustNetworkService],
})
export class TrustNetworkModule {}
