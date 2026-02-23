/**
 * Tests for the XP boost multiplier integration in XpService.addXp().
 * Verifies that the active boost event multiplier is correctly applied
 * based on the Redis key and appliesToActions filter.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { XpService } from './xp.service';
import { User } from '../entities/user.entity';
import { XpHistory } from '../entities/xp-history.entity';
import { QueueService } from '../../queue/queue.service';
import { AdminService } from '../../admin/services/admin.service';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { RedisService } from '../../redis/redis.service';
import { XpAction, XP_VALUES, PREMIUM_XP_MULTIPLIER } from '../constants/xp-actions.constants';
import { XP_BOOST_REDIS_KEY } from '../../admin/services/xp-boost.service';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    isPremium: false,
    xpMultiplier: null,
    currentXp: 0,
    level: 1,
    ...overrides,
  } as User);

describe('XpService — boost multiplier integration', () => {
  let service: XpService;
  let userRepo: any;
  let xpHistoryRepo: any;
  let adminService: any;
  let leaderboardService: any;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
        getCount: jest.fn().mockResolvedValue(0),
      }),
    };

    xpHistoryRepo = {
      save: jest.fn().mockResolvedValue({}),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };

    adminService = { getConfigValue: jest.fn().mockResolvedValue(1.0) };
    leaderboardService = { updateLeaderboard: jest.fn().mockResolvedValue(undefined) };
    redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      ttl: jest.fn().mockResolvedValue(-1),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XpService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(XpHistory), useValue: xpHistoryRepo },
        { provide: QueueService, useValue: { addNotificationJob: jest.fn() } },
        { provide: AdminService, useValue: adminService },
        { provide: LeaderboardService, useValue: leaderboardService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get(XpService);
  });

  it('applies no boost when Redis key is absent', async () => {
    const user = makeUser();
    userRepo.findOne.mockResolvedValue(user);
    redisService.get.mockResolvedValue(null);

    await service.addXp('user-1', XpAction.MESSAGE_SENT);

    const saved: User = userRepo.save.mock.calls[0][0];
    expect(saved.currentXp).toBe(XP_VALUES[XpAction.MESSAGE_SENT]);
  });

  it('applies boost multiplier for matching action', async () => {
    const user = makeUser();
    userRepo.findOne.mockResolvedValue(user);
    redisService.get.mockResolvedValue(
      JSON.stringify({ multiplier: 3, appliesToActions: ['MESSAGE_SENT'] }),
    );

    await service.addXp('user-1', XpAction.MESSAGE_SENT);

    const saved: User = userRepo.save.mock.calls[0][0];
    expect(saved.currentXp).toBe(XP_VALUES[XpAction.MESSAGE_SENT] * 3);
  });

  it("applies boost when appliesToActions is ['all']", async () => {
    const user = makeUser();
    userRepo.findOne.mockResolvedValue(user);
    redisService.get.mockResolvedValue(
      JSON.stringify({ multiplier: 2, appliesToActions: ['all'] }),
    );

    await service.addXp('user-1', XpAction.ROOM_JOINED);

    const saved: User = userRepo.save.mock.calls[0][0];
    expect(saved.currentXp).toBe(XP_VALUES[XpAction.ROOM_JOINED] * 2);
  });

  it('does NOT apply boost for non-matching action', async () => {
    const user = makeUser();
    userRepo.findOne.mockResolvedValue(user);
    redisService.get.mockResolvedValue(
      JSON.stringify({ multiplier: 5, appliesToActions: ['ROOM_CREATED'] }),
    );

    await service.addXp('user-1', XpAction.MESSAGE_SENT);

    const saved: User = userRepo.save.mock.calls[0][0];
    expect(saved.currentXp).toBe(XP_VALUES[XpAction.MESSAGE_SENT]);
  });

  it('stacks boost with global XP multiplier', async () => {
    const user = makeUser();
    userRepo.findOne.mockResolvedValue(user);
    adminService.getConfigValue.mockResolvedValue(2.0);
    redisService.get.mockResolvedValue(
      JSON.stringify({ multiplier: 3, appliesToActions: ['all'] }),
    );

    await service.addXp('user-1', XpAction.MESSAGE_SENT);

    const saved: User = userRepo.save.mock.calls[0][0];
    expect(saved.currentXp).toBe(
      Math.floor(XP_VALUES[XpAction.MESSAGE_SENT] * 1.0 * 2.0 * 3),
    );
  });

  it('stacks boost with premium user multiplier', async () => {
    const user = makeUser({ isPremium: true, xpMultiplier: PREMIUM_XP_MULTIPLIER });
    userRepo.findOne.mockResolvedValue(user);
    redisService.get.mockResolvedValue(
      JSON.stringify({ multiplier: 2, appliesToActions: ['all'] }),
    );

    await service.addXp('user-1', XpAction.MESSAGE_SENT);

    const saved: User = userRepo.save.mock.calls[0][0];
    expect(saved.currentXp).toBe(
      Math.floor(XP_VALUES[XpAction.MESSAGE_SENT] * PREMIUM_XP_MULTIPLIER * 1.0 * 2),
    );
  });

  it('ignores Redis parse errors gracefully', async () => {
    const user = makeUser();
    userRepo.findOne.mockResolvedValue(user);
    redisService.get.mockResolvedValue('not-valid-json');

    await expect(
      service.addXp('user-1', XpAction.MESSAGE_SENT),
    ).resolves.toBeDefined();

    const saved: User = userRepo.save.mock.calls[0][0];
    expect(saved.currentXp).toBe(XP_VALUES[XpAction.MESSAGE_SENT]);
  });

  it('reads the correct Redis key', async () => {
    const user = makeUser();
    userRepo.findOne.mockResolvedValue(user);

    await service.addXp('user-1', XpAction.MESSAGE_SENT);

    expect(redisService.get).toHaveBeenCalledWith(XP_BOOST_REDIS_KEY);
  });
});
