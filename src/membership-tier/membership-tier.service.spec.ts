import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MembershipTierService } from './membership-tier.service';
import { UsersRepository } from '../users/users.repository';
import { UserTier } from '../users/entities/user.entity';
import { TIER_BENEFITS } from './membership-tier.constants';

describe('MembershipTierService', () => {
  let service: MembershipTierService;
  let usersRepository: jest.Mocked<UsersRepository>;

  const mockUser = {
    id: 'user-1',
    tier: UserTier.SILVER,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipTierService,
        {
          provide: UsersRepository,
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MembershipTierService>(MembershipTierService);
    usersRepository = module.get(UsersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTierBenefits', () => {
    it('should return benefits for a valid tier', async () => {
      const result = await service.getTierBenefits(UserTier.GOLD);
      expect(result).toEqual(TIER_BENEFITS[UserTier.GOLD]);
    });

    it('should throw NotFoundException for an invalid tier', async () => {
      await expect(service.getTierBenefits('INVALID' as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserTierDetails', () => {
    it('should return user tier details with current flag', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser as any);
      
      const result = await service.getUserTierDetails('user-1');
      
      expect(result.tier).toBe(UserTier.SILVER);
      expect(result.current).toBe(true);
      expect(usersRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should throw NotFoundException if user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      await expect(service.getUserTierDetails('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upgradeTier', () => {
    it('should update user tier successfully', async () => {
      usersRepository.findOne.mockResolvedValue({ ...mockUser } as any);
      
      await service.upgradeTier('user-1', UserTier.BLACK);
      
      expect(usersRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'user-1',
        tier: UserTier.BLACK,
      }));
    });
  });
});
