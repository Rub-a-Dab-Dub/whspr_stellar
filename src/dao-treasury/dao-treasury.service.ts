import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Treasury } from './entities/treasury.entity';
import { ProposalStatus, TreasuryProposal } from './entities/treasury-proposal.entity';
import { TreasuryVote, VoteChoice } from './entities/treasury-vote.entity';
import { CastVoteDto, CreateProposalDto, DepositDto } from './dto/treasury.dto';
import { DaoTreasuryContractService } from './dao-treasury-contract.service';

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MAJORITY_BPS = 5001; // >50 %

@Injectable()
export class DaoTreasuryService {
  private readonly logger = new Logger(DaoTreasuryService.name);
  private readonly defaultTtl: number;

  constructor(
    @InjectRepository(Treasury)
    private readonly treasuryRepo: Repository<Treasury>,
    @InjectRepository(TreasuryProposal)
    private readonly proposalRepo: Repository<TreasuryProposal>,
    @InjectRepository(TreasuryVote)
    private readonly voteRepo: Repository<TreasuryVote>,
    private readonly contract: DaoTreasuryContractService,
    private readonly config: ConfigService,
  ) {
    this.defaultTtl = this.config.get<number>('PROPOSAL_TTL_SECONDS') ?? DEFAULT_TTL_SECONDS;
  }

  // ── Treasury ──────────────────────────────────────────────────────────────

  async getBalance(groupId: string): Promise<Treasury> {
    const treasury = await this.findOrCreateTreasury(groupId);

    try {
      const onChainBalance = await this.contract.getBalance(groupId);
      treasury.balance = onChainBalance;
      await this.treasuryRepo.save(treasury);
    } catch (err) {
      this.logger.warn(`Chain sync failed for group=${groupId}: ${String(err)}`);
    }

    return treasury;
  }

  async deposit(groupId: string, dto: DepositDto): Promise<Treasury> {
    const treasury = await this.findOrCreateTreasury(groupId, dto.tokenAddress);

    await this.contract.deposit(groupId, dto.amount);

    treasury.balance = (BigInt(treasury.balance) + BigInt(dto.amount)).toString();
    return this.treasuryRepo.save(treasury);
  }

  // ── Proposals ─────────────────────────────────────────────────────────────

  async createProposal(
    groupId: string,
    proposerId: string,
    dto: CreateProposalDto,
  ): Promise<TreasuryProposal> {
    const treasury = await this.findOrCreateTreasury(groupId);
    const ttl = dto.ttlSeconds ?? this.defaultTtl;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const proposal = this.proposalRepo.create({
      treasuryId: treasury.id,
      proposerId,
      recipientAddress: dto.recipientAddress,
      amount: dto.amount,
      description: dto.description,
      quorumRequired: dto.quorumRequired ?? 2,
      votesFor: 0,
      votesAgainst: 0,
      status: ProposalStatus.ACTIVE,
      sorobanTxHash: null,
      expiresAt,
    });

    return this.proposalRepo.save(proposal);
  }

  async getProposals(groupId: string): Promise<TreasuryProposal[]> {
    const treasury = await this.findTreasuryOrThrow(groupId);
    const proposals = await this.proposalRepo.find({
      where: { treasuryId: treasury.id },
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    const toExpire = proposals.filter(
      (p) => p.status === ProposalStatus.ACTIVE && p.expiresAt <= now,
    );

    if (toExpire.length) {
      for (const p of toExpire) p.status = ProposalStatus.EXPIRED;
      await this.proposalRepo.save(toExpire);
    }

    return proposals;
  }

  // ── Voting ────────────────────────────────────────────────────────────────

  async castVote(voterId: string, proposalId: string, dto: CastVoteDto): Promise<TreasuryProposal> {
    const proposal = await this.findActiveProposalOrThrow(proposalId);

    const existing = await this.voteRepo.findOne({
      where: { proposalId, voterId },
    });
    if (existing) throw new ConflictException('You have already voted on this proposal.');

    const vote = this.voteRepo.create({ proposalId, voterId, vote: dto.vote });
    await this.voteRepo.save(vote);

    if (dto.vote === VoteChoice.FOR) {
      proposal.votesFor += 1;
    } else {
      proposal.votesAgainst += 1;
    }

    proposal.status = this.resolveStatus(proposal);
    return this.proposalRepo.save(proposal);
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  async executeProposal(proposalId: string): Promise<TreasuryProposal> {
    const proposal = await this.findProposalOrThrow(proposalId);

    if (proposal.status === ProposalStatus.EXECUTED) {
      throw new BadRequestException('Proposal already executed.');
    }
    if (proposal.status === ProposalStatus.EXPIRED) {
      throw new BadRequestException('Proposal has expired.');
    }

    const totalVotes = proposal.votesFor + proposal.votesAgainst;

    if (totalVotes < proposal.quorumRequired) {
      throw new BadRequestException(
        `Quorum not met. Required ${proposal.quorumRequired}, got ${totalVotes}.`,
      );
    }

    const yesBps = (proposal.votesFor * 10_000) / totalVotes;
    if (yesBps < MAJORITY_BPS) {
      throw new BadRequestException('Majority not met. Proposal did not pass.');
    }

    const treasury = await this.findTreasuryOrThrow(undefined, proposal.treasuryId);
    if (BigInt(proposal.amount) > BigInt(treasury.balance)) {
      throw new BadRequestException('Insufficient treasury balance.');
    }

    const txHash = await this.contract.executeProposal(proposalId);

    treasury.balance = (BigInt(treasury.balance) - BigInt(proposal.amount)).toString();
    await this.treasuryRepo.save(treasury);

    proposal.status = ProposalStatus.EXECUTED;
    proposal.sorobanTxHash = txHash;
    return this.proposalRepo.save(proposal);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private resolveStatus(proposal: TreasuryProposal): ProposalStatus {
    if (proposal.expiresAt <= new Date()) return ProposalStatus.EXPIRED;

    const total = proposal.votesFor + proposal.votesAgainst;
    if (total < proposal.quorumRequired) return ProposalStatus.ACTIVE;

    const yesBps = (proposal.votesFor * 10_000) / total;
    return yesBps >= MAJORITY_BPS ? ProposalStatus.PASSED : ProposalStatus.REJECTED;
  }

  private async findOrCreateTreasury(groupId: string, tokenAddress?: string): Promise<Treasury> {
    let treasury = await this.treasuryRepo.findOne({ where: { groupId } });
    if (!treasury) {
      treasury = this.treasuryRepo.create({
        groupId,
        balance: '0',
        tokenAddress: tokenAddress ?? 'native',
      });
      treasury = await this.treasuryRepo.save(treasury);
    }
    return treasury;
  }

  private async findTreasuryOrThrow(groupId?: string, id?: string): Promise<Treasury> {
    const where = groupId ? { groupId } : { id };
    const treasury = await this.treasuryRepo.findOne({ where: where as any });
    if (!treasury) throw new NotFoundException('Treasury not found.');
    return treasury;
  }

  private async findProposalOrThrow(proposalId: string): Promise<TreasuryProposal> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException('Proposal not found.');
    return proposal;
  }

  private async findActiveProposalOrThrow(proposalId: string): Promise<TreasuryProposal> {
    const proposal = await this.findProposalOrThrow(proposalId);
    if (proposal.expiresAt <= new Date()) {
      if (proposal.status === ProposalStatus.ACTIVE) {
        proposal.status = ProposalStatus.EXPIRED;
        await this.proposalRepo.save(proposal);
      }
      throw new BadRequestException('Proposal has expired.');
    }
    if (proposal.status !== ProposalStatus.ACTIVE && proposal.status !== ProposalStatus.PASSED) {
      throw new BadRequestException(`Proposal is not open for voting (status: ${proposal.status}).`);
    }
    return proposal;
  }
}
