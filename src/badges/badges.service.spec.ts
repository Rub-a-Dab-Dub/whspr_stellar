import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BadgeKey, BadgeTier } from './entities/badge.entity';
import { BadgeRepository } from './badge.repository';
import { UserBadgeRepository } from './user-badge.repository';
import { BadgesService } from './badges.service';
import { NotificationsService } from '../notifications/notifications.service';

const mockBadge = (overrides = {}) => ({
  id: 'badge-uuid',
  key: BadgeKey.FIRST_TRANSFER,
  name: 'First Transfer',
  description: 'First transfer badge',
  iconUrl: null,
  tier: BadgeTier.BRONZE,
  criteria: { description: 'Complete 1 transfer', minTransfers: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockUserBadge = (overrides = {}) => ({
  id: 'ub-uuid',
  userId: 'user-uuid',
  badgeId: 'badge-uuid',
  badge: mockBadge(),
  isDisplayed: false,
  awardedAt: new Date(),
  ...overrides,
});

describe('BadgesService', () => {
  let service: BadgesService;
  let badgeRepo: jest.Mocked<BadgeRepository>;
  let userBadgeRepo: jest.Mocked<UserBadgeRepository>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgesService,
        {
          provide: BadgeRepository,
          useValue: {
            findAll: jest.fn(),
            findByKey: jest.fn(),
            findById: jest.fn(),
            upsert: jest.fn(),
          },
        },
        {
          provide: UserBadgeRepository,
          useValue: {
            findByUser: jest.fn(),
            findByUserAndBadge: jest.fn(),
            countDisplayed: jest.fn(),
            award: jest.fn(),
            updateDisplayed: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: { createNotification: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get(BadgesService);
    badgeRepo = module.get(BadgeRepository);
    userBadgeRepo = module.get(UserBadgeRepository);
    notificationsService = module.get(NotificationsService);

    // Suppress seed on bootstrap in unit tests
    jest.spyOn(service, 'seed').mockResolvedValue(undefined);
  });

  // ── seed ──────────────────────────────────────────────────────────────────

  describe('seed', () => {
    it('upserts all badge definitions', async () => {
      jest.spyOn(service, 'seed').mockRestore();
      badgeRepo.upsert.mockResolvedValue(mockBadge() as any);
      await service.seed();
      expect(badgeRepo.upsert).toHaveBeenCalledTimes(7); // 7 badge definitions
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns mapped badge DTOs', async () => {
      badgeRepo.findAll.mockResolvedValue([mockBadge() as any]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe(BadgeKey.FIRST_TRANSFER);
    });
  });

  // ── findForUser ───────────────────────────────────────────────────────────

  describe('findForUser', () => {
    it('returns user badge DTOs', async () => {
      userBadgeRepo.findByUser.mockResolvedValue([mockUserBadge() as any]);
      const result = await service.findForUser('user-uuid');
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-uuid');
    });
  });

  // ── awardBadge ────────────────────────────────────────────────────────────

  describe('awardBadge', () => {
    it('awards badge and sends notification', async () => {
      badgeRepo.findByKey.mockResolvedValue(mockBadge() as any);
      userBadgeRepo.award.mockResolvedValue(mockUserBadge() as any);
      userBadgeRepo.findByUserAndBadge.mockResolvedValue(mockUserBadge() as any);

      const result = await service.awardBadge('user-uuid', BadgeKey.FIRST_TRANSFER);
      expect(result).not.toBeNull();
      expect(result!.badgeId).toBe('badge-uuid');
      await new Promise((r) => setTimeout(r, 10));
      expect(notificationsService.createNotification).toHaveBeenCalled();
    });

    it('returns null when badge key not found', async () => {
      badgeRepo.findByKey.mockResolvedValue(null);
      const result = await service.awardBadge('user-uuid', BadgeKey.FIRST_TRANSFER);
      expect(result).toBeNull();
    });

    it('returns null when badge already awarded (idempotent)', async () => {
      badgeRepo.findByKey.mockResolvedValue(mockBadge() as any);
      userBadgeRepo.award.mockResolvedValue(null); // already exists
      const result = await service.awardBadge('user-uuid', BadgeKey.FIRST_TRANSFER);
      expect(result).toBeNull();
    });
  });

  // ── updateDisplayedBadges ─────────────────────────────────────────────────

  describe('updateDisplayedBadges', () => {
    it('updates displayed badges and returns updated list', async () => {
      userBadgeRepo.findByUserAndBadge.mockResolvedValue(mockUserBadge() as any);
      userBadgeRepo.updateDisplayed.mockResolvedValue(undefined);
      userBadgeRepo.findByUser.mockResolvedValue([mockUserBadge({ isDisplayed: true }) as any]);

      const result = await service.updateDisplayedBadges('user-uuid', ['badge-uuid']);
      expect(userBadgeRepo.updateDisplayed).toHaveBeenCalledWith('user-uuid', ['badge-uuid']);
      expect(result).toHaveLength(1);
    });

    it('throws BadRequestException for more than 3 badges', async () => {
      await expect(
        service.updateDisplayedBadges('user-uuid', ['a', 'b', 'c', 'd']),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when badge not in user collection', async () => {
      userBadgeRepo.findByUserAndBadge.mockResolvedValue(null);
      await expect(
        service.updateDisplayedBadges('user-uuid', ['unknown-badge']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── event triggers ────────────────────────────────────────────────────────

  describe('onTransferCompleted', () => {
    it('awards FIRST_TRANSFER for any amount', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onTransferCompleted('user-uuid', 100);
      expect(spy).toHaveBeenCalledWith('user-uuid', BadgeKey.FIRST_TRANSFER);
    });

    it('also awards CRYPTO_WHALE for amount >= 10000', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onTransferCompleted('user-uuid', 10000);
      expect(spy).toHaveBeenCalledWith('user-uuid', BadgeKey.CRYPTO_WHALE);
    });

    it('does not award CRYPTO_WHALE for amount < 10000', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onTransferCompleted('user-uuid', 9999);
      expect(spy).not.toHaveBeenCalledWith('user-uuid', BadgeKey.CRYPTO_WHALE);
    });
  });

  describe('onReferralCompleted', () => {
    it('awards TOP_REFERRER when referrals >= 5', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onReferralCompleted('user-uuid', 5);
      expect(spy).toHaveBeenCalledWith('user-uuid', BadgeKey.TOP_REFERRER);
    });

    it('does not award TOP_REFERRER when referrals < 5', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onReferralCompleted('user-uuid', 4);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('onMessageSent', () => {
    it('awards CHAT_CHAMPION when messages >= 100', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onMessageSent('user-uuid', 100);
      expect(spy).toHaveBeenCalledWith('user-uuid', BadgeKey.CHAT_CHAMPION);
    });

    it('does not award CHAT_CHAMPION when messages < 100', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onMessageSent('user-uuid', 99);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('onDaoVoteCast', () => {
    it('awards DAO_VOTER', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onDaoVoteCast('user-uuid');
      expect(spy).toHaveBeenCalledWith('user-uuid', BadgeKey.DAO_VOTER);
    });
  });

  describe('onGroupCreated', () => {
    it('awards GROUP_FOUNDER', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onGroupCreated('user-uuid');
      expect(spy).toHaveBeenCalledWith('user-uuid', BadgeKey.GROUP_FOUNDER);
    });
  });

  describe('onUserRegistered', () => {
    it('awards EARLY_ADOPTER for registration before cutoff', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onUserRegistered('user-uuid', new Date('2024-06-01'));
      expect(spy).toHaveBeenCalledWith('user-uuid', BadgeKey.EARLY_ADOPTER);
    });

    it('does not award EARLY_ADOPTER for registration after cutoff', async () => {
      const spy = jest.spyOn(service, 'awardBadge').mockResolvedValue(null);
      await service.onUserRegistered('user-uuid', new Date('2025-06-01'));
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
