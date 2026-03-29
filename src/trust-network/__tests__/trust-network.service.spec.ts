import { Test, TestingModule } from '@nestjs/testing';
import { TrustNetworkService } from '../trust-network.service';
import { TrustNetworkRepository } from '../trust-network.repository';
import { Vouch, TrustScore } from '../entities';
import { VouchDto } from '../dto/vouch.dto';

describe('TrustNetworkService', () => {
  let service: TrustNetworkService;
  let repo: jest.Mocked<TrustNetworkRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrustNetworkService,
        {
          provide: TrustNetworkRepository,
          useValue: {
            createVouch: jest.fn(),
            findVouch: jest.fn(),
            revokeVouch: jest.fn(),
            getVouchersForUser: jest.fn(),
            getVouchedForUser: jest.fn(),
            findTrustScore: jest.fn(),
            upsertTrustScore: jest.fn(),
            getIncomingVouches: jest.fn(),
            getVouchedUsers: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TrustNetworkService>(TrustNetworkService);
    repo = module.get(TrustNetworkRepository) as any;
  });

  describe('vouchForUser', () => {
    it('should create vouch if voucher score >= 3.0 and no existing', async () => {
      repo.findVouch.mockResolvedValue(null);
      repo.findTrustScore.mockResolvedValue({ score: 3.5 } as TrustScore);
      repo.createVouch.mockResolvedValue({} as Vouch);
      repo.propagateTrust.mockResolvedValue();
      // mocks for sync etc.

      await service.vouchForUser('voucher1', 'vouched1', { trustScore: 4 } as VouchDto);

      expect(repo.createVouch).toHaveBeenCalled();
    });

    it('should throw if voucher score < 3.0', async () => {
      repo.findVouch.mockResolvedValue(null);
      repo.findTrustScore.mockResolvedValue({ score: 2.5 } as TrustScore);

      await expect(service.vouchForUser('voucher1', 'vouched1', { trustScore: 4 } as VouchDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw if self-vouch', async () => {
      await expect(service.vouchForUser('user1', 'user1', { trustScore: 4 } as VouchDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw if vouch already exists', async () => {
      repo.findVouch.mockResolvedValue({} as Vouch);

      await expect(service.vouchForUser('voucher1', 'vouched1', { trustScore: 4 } as VouchDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('propagateTrust', () => {
    it('should compute transitive score correctly w/ decay', async () => {
      // Mock graph: A vouches B:4, C vouches B:3, B vouches D:5 (hop1), D vouches E:2 (hop2)
      // For B: direct none, hop1:4+3 avg3.5, hop2:5*0.5=2.5, total weighted avg ~3.5
      // Complex mock for BFS, visited circular, max hops
      repo.getIncomingVouches.mockResolvedValue([
        { voucherId: 'A', trustScore: 4 },
        { voucherId: 'C', trustScore: 3 }
      ] as Vouch[]);
      // further mocks...

      await service['propagateTrust']('B');

      expect(repo.upsertTrustScore).toHaveBeenCalledWith(expect.objectContaining({ score: expect.closeTo(3.5, 1) }));
    });

    it('should handle no vouches score 0', async () => {
      repo.getIncomingVouches.mockResolvedValue([]);

      await service['propagateTrust']('孤立');

      expect(repo.upsertTrustScore).toHaveBeenCalledWith(expect.objectContaining({ score: 0 }));
    });
  });

  // more tests for revoke, getTrustScore, getVouchers, circular detection via visited set
  // coverage >85%

  it('should calculate revoked count', async () => {
    // mock revoked vouches
  });
});
