import { Test, TestingModule } from '@nestjs/testing';
import { ReferralsService } from './referrals.service';
import { ReferralsRepository } from '../repositories/referrals.repository';
import { UsersRepository } from '../../users/users.repository';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException } from '@nestjs/common';
import { ReferralStatus } from '../entities/referral.entity';
import { UserTier } from '../../users/entities/user.entity';

describe('ReferralsService', () => {
  let service: ReferralsService;
  let referralsRepository: Partial<ReferralsRepository>;
  let usersRepository: Partial<UsersRepository>;
  let cacheManager: any;

  beforeEach(async () => {
    referralsRepository = {
      create: jest.fn(),
      findByRefereeId: jest.fn(),
      findByReferrerId: jest.fn(),
      getLeaderboard: jest.fn(),
      update: jest.fn(),
      findPendingByRefereeId: jest.fn(),
    };

    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: ReferralsRepository, useValue: referralsRepository },
        { provide: UsersRepository, useValue: usersRepository },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
  });

  describe('generateCode', () => {
    it('should return existing code if user already has one', async () => {
      const user = { id: 'u1', referralCode: 'EXISTING' };
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);

      const code = await service.generateCode('u1');
      expect(code).toBe('EXISTING');
    });

    it('should generate a new code and save it if user has none', async () => {
      const user = { id: 'u1', referralCode: null };
      (usersRepository.findOne as jest.Mock).mockResolvedValueOnce(user);
      (usersRepository.findOne as jest.Mock).mockResolvedValueOnce(null); // Unique check

      const code = await service.generateCode('u1');
      expect(code).toBeDefined();
      expect(usersRepository.save).toHaveBeenCalled();
    });
  });

  describe('applyReferralCode', () => {
    it('should throw if self-referral', async () => {
      const user = { id: 'u1', referralCode: 'CODE1' };
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.applyReferralCode('u1', 'CODE1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if user already has a referral record', async () => {
      const user = { id: 'u2', referralCode: 'CODE1' };
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);
      (referralsRepository.findByRefereeId as jest.Mock).mockResolvedValue({ id: 'r1' });

      await expect(service.applyReferralCode('u1', 'CODE1')).rejects.toThrow(BadRequestException);
    });

    it('should create a pending referral on success', async () => {
      const referrer = { id: 'u2', referralCode: 'CODE1' };
      (usersRepository.findOne as jest.Mock).mockResolvedValue(referrer);
      (referralsRepository.findByRefereeId as jest.Mock).mockResolvedValue(null);

      await service.applyReferralCode('u1', 'CODE1');
      expect(referralsRepository.create).toHaveBeenCalledWith({
        referrerId: 'u2',
        refereeId: 'u1',
        referralCode: 'CODE1',
        status: ReferralStatus.PENDING,
      });
    });
  });

  describe('processReward', () => {
    it('should correctly credit reward based on referrer tier (VIP)', async () => {
      const referral = { id: 'r1', referrer: { id: 'u2', tier: UserTier.VIP } };
      (referralsRepository.findPendingByRefereeId as jest.Mock).mockResolvedValue(referral);

      await service.processReward('u1');
      expect(referralsRepository.update).toHaveBeenCalledWith('r1', expect.objectContaining({
        status: ReferralStatus.COMPLETED,
        rewardAmount: 50,
      }));
    });

    it('should correctly credit reward based on referrer tier (FREE)', async () => {
      const referral = { id: 'r1', referrer: { id: 'u2', tier: UserTier.FREE } };
      (referralsRepository.findPendingByRefereeId as jest.Mock).mockResolvedValue(referral);

      await service.processReward('u1');
      expect(referralsRepository.update).toHaveBeenCalledWith('r1', expect.objectContaining({
        rewardAmount: 10,
      }));
    });
  });
});
