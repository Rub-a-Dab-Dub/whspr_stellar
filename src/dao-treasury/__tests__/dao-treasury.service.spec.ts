import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { DaoTreasuryService } from '../dao-treasury.service';
import { DaoTreasuryContractService } from '../dao-treasury-contract.service';
import { Treasury } from '../entities/treasury.entity';
import { ProposalStatus, TreasuryProposal } from '../entities/treasury-proposal.entity';
import { TreasuryVote, VoteChoice } from '../entities/treasury-vote.entity';
import { DepositDto, CreateProposalDto, CastVoteDto } from '../dto/treasury.dto';

const GROUP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TREASURY_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PROPOSAL_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function makeTreasury(overrides: Partial<Treasury> = {}): Treasury {
  return Object.assign(new Treasury(), {
    id: TREASURY_ID,
    groupId: GROUP_ID,
    balance: '1000',
    tokenAddress: 'native',
    lastSyncedAt: new Date(),
    ...overrides,
  });
}

function makeProposal(overrides: Partial<TreasuryProposal> = {}): TreasuryProposal {
  return Object.assign(new TreasuryProposal(), {
    id: PROPOSAL_ID,
    treasuryId: TREASURY_ID,
    proposerId: USER_ID,
    recipientAddress: 'GABCDE',
    amount: '100',
    description: 'Test proposal',
    status: ProposalStatus.ACTIVE,
    quorumRequired: 2,
    votesFor: 0,
    votesAgainst: 0,
    sorobanTxHash: null,
    expiresAt: new Date(Date.now() + 86400_000),
    createdAt: new Date(),
    ...overrides,
  });
}

describe('DaoTreasuryService', () => {
  let service: DaoTreasuryService;
  let treasuryRepo: jest.Mocked<Repository<Treasury>>;
  let proposalRepo: jest.Mocked<Repository<TreasuryProposal>>;
  let voteRepo: jest.Mocked<Repository<TreasuryVote>>;
  let contract: jest.Mocked<DaoTreasuryContractService>;

  beforeEach(async () => {
    const mockRepo = () => ({
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DaoTreasuryService,
        { provide: getRepositoryToken(Treasury), useFactory: mockRepo },
        { provide: getRepositoryToken(TreasuryProposal), useFactory: mockRepo },
        { provide: getRepositoryToken(TreasuryVote), useFactory: mockRepo },
        {
          provide: DaoTreasuryContractService,
          useValue: {
            getBalance: jest.fn(),
            deposit: jest.fn(),
            executeProposal: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(DaoTreasuryService);
    treasuryRepo = module.get(getRepositoryToken(Treasury));
    proposalRepo = module.get(getRepositoryToken(TreasuryProposal));
    voteRepo = module.get(getRepositoryToken(TreasuryVote));
    contract = module.get(DaoTreasuryContractService);
  });

  // ── getBalance ─────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('syncs balance from chain and returns treasury', async () => {
      const treasury = makeTreasury();
      treasuryRepo.findOne.mockResolvedValue(treasury);
      contract.getBalance.mockResolvedValue('2000');
      treasuryRepo.save.mockResolvedValue({ ...treasury, balance: '2000' } as Treasury);

      const result = await service.getBalance(GROUP_ID);

      expect(contract.getBalance).toHaveBeenCalledWith(GROUP_ID);
      expect(treasuryRepo.save).toHaveBeenCalled();
      expect(result.balance).toBe('2000');
    });

    it('returns stale balance when chain call fails', async () => {
      const treasury = makeTreasury();
      treasuryRepo.findOne.mockResolvedValue(treasury);
      contract.getBalance.mockRejectedValue(new Error('RPC error'));
      treasuryRepo.save.mockResolvedValue(treasury);

      const result = await service.getBalance(GROUP_ID);
      expect(result.balance).toBe('1000');
    });

    it('creates treasury when none exists', async () => {
      treasuryRepo.findOne.mockResolvedValue(null);
      const created = makeTreasury({ balance: '0' });
      treasuryRepo.create.mockReturnValue(created);
      treasuryRepo.save.mockResolvedValue(created);
      contract.getBalance.mockResolvedValue('0');

      await service.getBalance(GROUP_ID);
      expect(treasuryRepo.create).toHaveBeenCalled();
    });
  });

  // ── deposit ────────────────────────────────────────────────────────────────

  describe('deposit', () => {
    it('calls contract and updates balance', async () => {
      const treasury = makeTreasury({ balance: '500' });
      treasuryRepo.findOne.mockResolvedValue(treasury);
      contract.deposit.mockResolvedValue('tx123');
      treasuryRepo.save.mockImplementation(async (t) => t as Treasury);

      const dto: DepositDto = { amount: '200', tokenAddress: 'native' };
      const result = await service.deposit(GROUP_ID, dto);

      expect(contract.deposit).toHaveBeenCalledWith(GROUP_ID, '200');
      expect(result.balance).toBe('700');
    });
  });

  // ── createProposal ─────────────────────────────────────────────────────────

  describe('createProposal', () => {
    it('creates proposal with correct TTL', async () => {
      const treasury = makeTreasury();
      treasuryRepo.findOne.mockResolvedValue(treasury);
      const proposal = makeProposal();
      proposalRepo.create.mockReturnValue(proposal);
      proposalRepo.save.mockResolvedValue(proposal);

      const dto: CreateProposalDto = {
        recipientAddress: 'GABCDE',
        amount: '100',
        description: 'Pay dev',
        quorumRequired: 3,
        ttlSeconds: 3600,
      };

      const result = await service.createProposal(GROUP_ID, USER_ID, dto);

      expect(proposalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          treasuryId: TREASURY_ID,
          proposerId: USER_ID,
          quorumRequired: 3,
        }),
      );
      expect(result.id).toBe(PROPOSAL_ID);
    });

    it('uses default TTL when not provided', async () => {
      const treasury = makeTreasury();
      treasuryRepo.findOne.mockResolvedValue(treasury);
      const proposal = makeProposal();
      proposalRepo.create.mockReturnValue(proposal);
      proposalRepo.save.mockResolvedValue(proposal);

      const dto: CreateProposalDto = {
        recipientAddress: 'GABCDE',
        amount: '50',
        description: 'No TTL',
        quorumRequired: 2,
      };

      await service.createProposal(GROUP_ID, USER_ID, dto);

      const createCall = proposalRepo.create.mock.calls[0][0] as Partial<TreasuryProposal>;
      const ttlMs = createCall.expiresAt!.getTime() - Date.now();
      // default 7 days ± 5 s tolerance
      expect(ttlMs).toBeGreaterThan(7 * 24 * 3600 * 1000 - 5000);
    });
  });

  // ── getProposals ───────────────────────────────────────────────────────────

  describe('getProposals', () => {
    it('returns proposals and marks expired ones', async () => {
      const treasury = makeTreasury();
      treasuryRepo.findOne.mockResolvedValue(treasury);

      const expired = makeProposal({
        id: 'exp-id',
        status: ProposalStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
      });
      const active = makeProposal();
      proposalRepo.find.mockResolvedValue([expired, active]);
      proposalRepo.save.mockResolvedValue(expired);

      const results = await service.getProposals(GROUP_ID);

      expect(proposalRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ status: ProposalStatus.EXPIRED })]),
      );
      expect(results).toHaveLength(2);
    });

    it('throws when treasury not found', async () => {
      treasuryRepo.findOne.mockResolvedValue(null);
      await expect(service.getProposals(GROUP_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── castVote ───────────────────────────────────────────────────────────────

  describe('castVote', () => {
    it('records FOR vote and increments votesFor', async () => {
      const proposal = makeProposal({ votesFor: 0, votesAgainst: 0 });
      proposalRepo.findOne.mockResolvedValue(proposal);
      voteRepo.findOne.mockResolvedValue(null);
      const vote = Object.assign(new TreasuryVote(), {
        proposalId: PROPOSAL_ID,
        voterId: USER_ID,
        vote: VoteChoice.FOR,
      });
      voteRepo.create.mockReturnValue(vote);
      voteRepo.save.mockResolvedValue(vote);
      proposalRepo.save.mockImplementation(async (p) => p as TreasuryProposal);

      const dto: CastVoteDto = { vote: VoteChoice.FOR };
      const result = await service.castVote(USER_ID, PROPOSAL_ID, dto);

      expect(result.votesFor).toBe(1);
      expect(result.votesAgainst).toBe(0);
    });

    it('records AGAINST vote and increments votesAgainst', async () => {
      const proposal = makeProposal({ votesFor: 1, votesAgainst: 0 });
      proposalRepo.findOne.mockResolvedValue(proposal);
      voteRepo.findOne.mockResolvedValue(null);
      const vote = Object.assign(new TreasuryVote(), { vote: VoteChoice.AGAINST });
      voteRepo.create.mockReturnValue(vote);
      voteRepo.save.mockResolvedValue(vote);
      proposalRepo.save.mockImplementation(async (p) => p as TreasuryProposal);

      const result = await service.castVote(USER_ID, PROPOSAL_ID, { vote: VoteChoice.AGAINST });
      expect(result.votesAgainst).toBe(1);
    });

    it('throws ConflictException on duplicate vote', async () => {
      const proposal = makeProposal();
      proposalRepo.findOne.mockResolvedValue(proposal);
      voteRepo.findOne.mockResolvedValue(Object.assign(new TreasuryVote(), { id: 'existing' }));

      await expect(
        service.castVote(USER_ID, PROPOSAL_ID, { vote: VoteChoice.FOR }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException on expired proposal', async () => {
      const proposal = makeProposal({ expiresAt: new Date(Date.now() - 1000) });
      proposalRepo.findOne.mockResolvedValue(proposal);
      proposalRepo.save.mockResolvedValue(proposal);

      await expect(
        service.castVote(USER_ID, PROPOSAL_ID, { vote: VoteChoice.FOR }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when proposal missing', async () => {
      proposalRepo.findOne.mockResolvedValue(null);
      await expect(
        service.castVote(USER_ID, PROPOSAL_ID, { vote: VoteChoice.FOR }),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets status to PASSED when quorum + majority met', async () => {
      const proposal = makeProposal({ quorumRequired: 2, votesFor: 1, votesAgainst: 0 });
      proposalRepo.findOne.mockResolvedValue(proposal);
      voteRepo.findOne.mockResolvedValue(null);
      voteRepo.create.mockReturnValue(Object.assign(new TreasuryVote(), { vote: VoteChoice.FOR }));
      voteRepo.save.mockResolvedValue({} as TreasuryVote);
      proposalRepo.save.mockImplementation(async (p) => p as TreasuryProposal);

      const result = await service.castVote(USER_ID, PROPOSAL_ID, { vote: VoteChoice.FOR });
      expect(result.status).toBe(ProposalStatus.PASSED);
    });

    it('sets status to REJECTED when quorum met but majority not', async () => {
      const proposal = makeProposal({ quorumRequired: 2, votesFor: 0, votesAgainst: 1 });
      proposalRepo.findOne.mockResolvedValue(proposal);
      voteRepo.findOne.mockResolvedValue(null);
      voteRepo.create.mockReturnValue(
        Object.assign(new TreasuryVote(), { vote: VoteChoice.AGAINST }),
      );
      voteRepo.save.mockResolvedValue({} as TreasuryVote);
      proposalRepo.save.mockImplementation(async (p) => p as TreasuryProposal);

      const result = await service.castVote(USER_ID, PROPOSAL_ID, { vote: VoteChoice.AGAINST });
      expect(result.status).toBe(ProposalStatus.REJECTED);
    });
  });

  // ── executeProposal ────────────────────────────────────────────────────────

  describe('executeProposal', () => {
    it('executes passed proposal and deducts balance', async () => {
      const proposal = makeProposal({
        status: ProposalStatus.PASSED,
        votesFor: 3,
        votesAgainst: 1,
        quorumRequired: 2,
        amount: '100',
      });
      const treasury = makeTreasury({ balance: '1000' });
      proposalRepo.findOne.mockResolvedValue(proposal);
      treasuryRepo.findOne.mockResolvedValue(treasury);
      contract.executeProposal.mockResolvedValue('txhash_abc');
      treasuryRepo.save.mockResolvedValue({ ...treasury, balance: '900' } as Treasury);
      proposalRepo.save.mockImplementation(async (p) => p as TreasuryProposal);

      const result = await service.executeProposal(PROPOSAL_ID);

      expect(contract.executeProposal).toHaveBeenCalledWith(PROPOSAL_ID);
      expect(result.status).toBe(ProposalStatus.EXECUTED);
      expect(result.sorobanTxHash).toBe('txhash_abc');
    });

    it('throws when quorum not met', async () => {
      const proposal = makeProposal({
        status: ProposalStatus.ACTIVE,
        votesFor: 1,
        votesAgainst: 0,
        quorumRequired: 5,
      });
      proposalRepo.findOne.mockResolvedValue(proposal);

      await expect(service.executeProposal(PROPOSAL_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws when majority not met', async () => {
      const proposal = makeProposal({
        status: ProposalStatus.ACTIVE,
        votesFor: 1,
        votesAgainst: 3,
        quorumRequired: 2,
      });
      proposalRepo.findOne.mockResolvedValue(proposal);

      await expect(service.executeProposal(PROPOSAL_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws when already executed', async () => {
      const proposal = makeProposal({ status: ProposalStatus.EXECUTED });
      proposalRepo.findOne.mockResolvedValue(proposal);

      await expect(service.executeProposal(PROPOSAL_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws when expired', async () => {
      const proposal = makeProposal({ status: ProposalStatus.EXPIRED });
      proposalRepo.findOne.mockResolvedValue(proposal);

      await expect(service.executeProposal(PROPOSAL_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws when insufficient treasury balance', async () => {
      const proposal = makeProposal({
        status: ProposalStatus.PASSED,
        votesFor: 3,
        votesAgainst: 0,
        quorumRequired: 2,
        amount: '9999',
      });
      const treasury = makeTreasury({ balance: '100' });
      proposalRepo.findOne.mockResolvedValue(proposal);
      treasuryRepo.findOne.mockResolvedValue(treasury);

      await expect(service.executeProposal(PROPOSAL_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when proposal missing', async () => {
      proposalRepo.findOne.mockResolvedValue(null);
      await expect(service.executeProposal(PROPOSAL_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── ProposalExpiryJob ──────────────────────────────────────────────────────

  describe('ProposalExpiryJob (inline)', () => {
    it('bulk-updates expired active proposals', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      proposalRepo.createQueryBuilder.mockReturnValue(qb as any);

      // Import and instantiate job directly
      const { ProposalExpiryJob } = await import('../proposal-expiry.job');
      const job = new ProposalExpiryJob(proposalRepo as any);
      await job.expireProposals();

      expect(qb.execute).toHaveBeenCalled();
    });
  });
});
