import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReputationScore } from './entities/reputation-score.entity';
import { UserRating } from './entities/user-rating.entity';
import { ReputationRepository } from './reputation.repository';
import { ReputationService } from './reputation.service';
import { ReputationController } from './reputation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReputationScore, UserRating]), TrustNetworkModule],
  controllers: [ReputationController],
  providers: [ReputationService, ReputationRepository],
  exports: [ReputationService],
})
export class ReputationModule {}
