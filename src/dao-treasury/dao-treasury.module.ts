import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Treasury } from './entities/treasury.entity';
import { TreasuryProposal } from './entities/treasury-proposal.entity';
import { TreasuryVote } from './entities/treasury-vote.entity';
import { DaoTreasuryController } from './dao-treasury.controller';
import { DaoTreasuryService } from './dao-treasury.service';
import { DaoTreasuryContractService } from './dao-treasury-contract.service';
import { ProposalExpiryJob } from './proposal-expiry.job';
import { SorobanModule } from '../soroban/soroban.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Treasury, TreasuryProposal, TreasuryVote]),
    SorobanModule,
  ],
  controllers: [DaoTreasuryController],
  providers: [DaoTreasuryService, DaoTreasuryContractService, ProposalExpiryJob],
  exports: [DaoTreasuryService],
})
export class DaoTreasuryModule {}
