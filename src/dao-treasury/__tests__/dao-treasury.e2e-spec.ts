import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DaoTreasuryController } from '../dao-treasury.controller';
import { DaoTreasuryService } from '../dao-treasury.service';
import { ProposalStatus, TreasuryProposal } from '../entities/treasury-proposal.entity';
import { Treasury } from '../entities/treasury.entity';
import { VoteChoice } from '../entities/treasury-vote.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

const GROUP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PROPOSAL_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const mockTreasury: Treasury = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  groupId: GROUP_ID,
  balance: '1000',
  tokenAddress: 'native',
  lastSyncedAt: new Date('2024-01-01'),
  proposals: [],
};

const mockProposal: TreasuryProposal = {
  id: PROPOSAL_ID,
  treasuryId: mockTreasury.id,
  proposerId: USER_ID,
  recipientAddress: 'GABCDE',
  amount: '100',
  description: 'Pay dev',
  status: ProposalStatus.ACTIVE,
  quorumRequired: 2,
  votesFor: 0,
  votesAgainst: 0,
  sorobanTxHash: null,
  expiresAt: new Date(Date.now() + 86400_000),
  createdAt: new Date(),
  treasury: mockTreasury,
  votes: [],
};

describe('DaoTreasuryController (e2e)', () => {
  let app: INestApplication;
  let service: jest.Mocked<DaoTreasuryService>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DaoTreasuryController],
      providers: [
        {
          provide: DaoTreasuryService,
          useValue: {
            getBalance: jest.fn().mockResolvedValue(mockTreasury),
            deposit: jest.fn().mockResolvedValue({ ...mockTreasury, balance: '1200' }),
            createProposal: jest.fn().mockResolvedValue(mockProposal),
            getProposals: jest.fn().mockResolvedValue([mockProposal]),
            castVote: jest.fn().mockResolvedValue({ ...mockProposal, votesFor: 1 }),
            executeProposal: jest
              .fn()
              .mockResolvedValue({ ...mockProposal, status: ProposalStatus.EXECUTED, sorobanTxHash: 'txhash' }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { id: USER_ID };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    service = module.get(DaoTreasuryService);
  });

  afterAll(() => app.close());

  // ── GET /groups/:id/treasury ───────────────────────────────────────────────

  describe('GET /groups/:id/treasury', () => {
    it('returns treasury with synced balance', async () => {
      const res = await request(app.getHttpServer())
        .get(`/groups/${GROUP_ID}/treasury`)
        .expect(200);

      expect(res.body.groupId).toBe(GROUP_ID);
      expect(res.body.balance).toBe('1000');
      expect(service.getBalance).toHaveBeenCalledWith(GROUP_ID);
    });

    it('returns 400 for invalid UUID', () => {
      return request(app.getHttpServer()).get('/groups/not-a-uuid/treasury').expect(400);
    });
  });

  // ── POST /groups/:id/treasury/deposit ─────────────────────────────────────

  describe('POST /groups/:id/treasury/deposit', () => {
    it('deposits and returns updated treasury', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${GROUP_ID}/treasury/deposit`)
        .send({ amount: '200', tokenAddress: 'native' })
        .expect(200);

      expect(res.body.balance).toBe('1200');
      expect(service.deposit).toHaveBeenCalledWith(
        GROUP_ID,
        expect.objectContaining({ amount: '200' }),
      );
    });

    it('rejects missing amount', () => {
      return request(app.getHttpServer())
        .post(`/groups/${GROUP_ID}/treasury/deposit`)
        .send({ tokenAddress: 'native' })
        .expect(400);
    });

    it('rejects missing tokenAddress', () => {
      return request(app.getHttpServer())
        .post(`/groups/${GROUP_ID}/treasury/deposit`)
        .send({ amount: '100' })
        .expect(400);
    });
  });

  // ── POST /groups/:id/treasury/proposals ───────────────────────────────────

  describe('POST /groups/:id/treasury/proposals', () => {
    it('creates a proposal', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${GROUP_ID}/treasury/proposals`)
        .send({
          recipientAddress: 'GABCDE',
          amount: '100',
          description: 'Pay dev',
          quorumRequired: 2,
        })
        .expect(201);

      expect(res.body.id).toBe(PROPOSAL_ID);
      expect(res.body.status).toBe(ProposalStatus.ACTIVE);
      expect(service.createProposal).toHaveBeenCalledWith(
        GROUP_ID,
        USER_ID,
        expect.objectContaining({ recipientAddress: 'GABCDE', amount: '100' }),
      );
    });

    it('rejects missing recipientAddress', () => {
      return request(app.getHttpServer())
        .post(`/groups/${GROUP_ID}/treasury/proposals`)
        .send({ amount: '100', description: 'x', quorumRequired: 2 })
        .expect(400);
    });

    it('rejects missing description', () => {
      return request(app.getHttpServer())
        .post(`/groups/${GROUP_ID}/treasury/proposals`)
        .send({ recipientAddress: 'GABCDE', amount: '100', quorumRequired: 2 })
        .expect(400);
    });

    it('rejects quorumRequired < 1', () => {
      return request(app.getHttpServer())
        .post(`/groups/${GROUP_ID}/treasury/proposals`)
        .send({ recipientAddress: 'GABCDE', amount: '100', description: 'x', quorumRequired: 0 })
        .expect(400);
    });
  });

  // ── GET /groups/:id/treasury/proposals ────────────────────────────────────

  describe('GET /groups/:id/treasury/proposals', () => {
    it('returns list of proposals', async () => {
      const res = await request(app.getHttpServer())
        .get(`/groups/${GROUP_ID}/treasury/proposals`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].id).toBe(PROPOSAL_ID);
    });
  });

  // ── POST /proposals/:id/vote ───────────────────────────────────────────────

  describe('POST /proposals/:id/vote', () => {
    it('casts a FOR vote', async () => {
      const res = await request(app.getHttpServer())
        .post(`/proposals/${PROPOSAL_ID}/vote`)
        .send({ vote: VoteChoice.FOR })
        .expect(200);

      expect(res.body.votesFor).toBe(1);
      expect(service.castVote).toHaveBeenCalledWith(
        USER_ID,
        PROPOSAL_ID,
        expect.objectContaining({ vote: VoteChoice.FOR }),
      );
    });

    it('casts an AGAINST vote', async () => {
      await request(app.getHttpServer())
        .post(`/proposals/${PROPOSAL_ID}/vote`)
        .send({ vote: VoteChoice.AGAINST })
        .expect(200);

      expect(service.castVote).toHaveBeenCalledWith(
        USER_ID,
        PROPOSAL_ID,
        expect.objectContaining({ vote: VoteChoice.AGAINST }),
      );
    });

    it('rejects invalid vote value', () => {
      return request(app.getHttpServer())
        .post(`/proposals/${PROPOSAL_ID}/vote`)
        .send({ vote: 'MAYBE' })
        .expect(400);
    });

    it('rejects missing vote field', () => {
      return request(app.getHttpServer())
        .post(`/proposals/${PROPOSAL_ID}/vote`)
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid UUID', () => {
      return request(app.getHttpServer())
        .post('/proposals/bad-id/vote')
        .send({ vote: VoteChoice.FOR })
        .expect(400);
    });
  });

  // ── POST /proposals/:id/execute ───────────────────────────────────────────

  describe('POST /proposals/:id/execute', () => {
    it('executes proposal and returns EXECUTED status with tx hash', async () => {
      const res = await request(app.getHttpServer())
        .post(`/proposals/${PROPOSAL_ID}/execute`)
        .expect(200);

      expect(res.body.status).toBe(ProposalStatus.EXECUTED);
      expect(res.body.sorobanTxHash).toBe('txhash');
      expect(service.executeProposal).toHaveBeenCalledWith(PROPOSAL_ID);
    });

    it('returns 400 for invalid UUID', () => {
      return request(app.getHttpServer()).post('/proposals/bad-id/execute').expect(400);
    });

    it('propagates service BadRequestException as 400', async () => {
      service.executeProposal.mockRejectedValueOnce(
        new (await import('@nestjs/common')).BadRequestException('Quorum not met.'),
      );

      await request(app.getHttpServer())
        .post(`/proposals/${PROPOSAL_ID}/execute`)
        .expect(400);
    });

    it('propagates service NotFoundException as 404', async () => {
      service.executeProposal.mockRejectedValueOnce(
        new (await import('@nestjs/common')).NotFoundException('Proposal not found.'),
      );

      await request(app.getHttpServer())
        .post(`/proposals/${PROPOSAL_ID}/execute`)
        .expect(404);
    });
  });
});
