import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ProposalStatus, TreasuryProposal } from './entities/treasury-proposal.entity';

@Injectable()
export class ProposalExpiryJob {
  private readonly logger = new Logger(ProposalExpiryJob.name);

  constructor(
    @InjectRepository(TreasuryProposal)
    private readonly proposalRepo: Repository<TreasuryProposal>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireProposals(): Promise<void> {
    const result = await this.proposalRepo
      .createQueryBuilder()
      .update(TreasuryProposal)
      .set({ status: ProposalStatus.EXPIRED })
      .where('status = :status', { status: ProposalStatus.ACTIVE })
      .andWhere('expiresAt <= :now', { now: new Date() })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} proposal(s).`);
    }
  }
}
