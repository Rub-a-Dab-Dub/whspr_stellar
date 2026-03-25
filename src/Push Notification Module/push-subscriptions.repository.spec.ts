import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscriptionsRepository } from '../repositories/push-subscriptions.repository';
import { Platform, PushSubscription } from '../entities/push-subscription.entity';

const makeSub = (overrides: Partial<PushSubscription> = {}): PushSubscription =>
  ({
    id: 'sub-1',
    userId: 'user-1',
    deviceToken: 'token-abc',
    platform: Platform.FCM,
    isActive: true,
    lastUsedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PushSubscription);

describe('PushSubscriptionsRepository', () => {
  let repo: PushSubscriptionsRepository;
  let ormRepo: jest.Mocked<Repository<PushSubscription>>;

  beforeEach(async () => {
    const mockOrmRepo: Partial<jest.Mocked<Repository<PushSubscription>>> = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushSubscriptionsRepository,
        { provide: getRepositoryToken(PushSubscription), useValue: mockOrmRepo },
      ],
    }).compile();

    repo = module.get(PushSubscriptionsRepository);
    ormRepo = module.get(getRepositoryToken(PushSubscription));
  });

  describe('upsert', () => {
    it('should update existing subscription and return isNew=false', async () => {
      const existing = makeSub();
      ormRepo.findOne.mockResolvedValue(existing);
      ormRepo.save.mockResolvedValue({ ...existing, isActive: true });

      const { subscription, isNew } = await repo.upsert('user-1', 'token-abc', Platform.FCM);

      expect(isNew).toBe(false);
      expect(ormRepo.save).toHaveBeenCalled();
    });

    it('should create new subscription and return isNew=true', async () => {
      const newSub = makeSub();
      ormRepo.findOne.mockResolvedValue(null);
      ormRepo.create.mockReturnValue(newSub);
      ormRepo.save.mockResolvedValue(newSub);

      const { subscription, isNew } = await repo.upsert('user-1', 'token-new', Platform.FCM);

      expect(isNew).toBe(true);
      expect(ormRepo.create).toHaveBeenCalled();
    });
  });

  describe('removeInvalidTokens', () => {
    it('should delete records matching tokens', async () => {
      ormRepo.delete.mockResolvedValue({ affected: 2, raw: [] });
      const count = await repo.removeInvalidTokens(['t1', 't2']);
      expect(count).toBe(2);
    });

    it('should return 0 for empty array without querying', async () => {
      const count = await repo.removeInvalidTokens([]);
      expect(count).toBe(0);
      expect(ormRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('findActiveByUserIds', () => {
    it('should return empty array for empty userIds', async () => {
      const result = await repo.findActiveByUserIds([]);
      expect(result).toEqual([]);
      expect(ormRepo.find).not.toHaveBeenCalled();
    });

    it('should query subscriptions for given user IDs', async () => {
      const subs = [makeSub({ userId: 'u1' }), makeSub({ userId: 'u2', id: 's2' })];
      ormRepo.find.mockResolvedValue(subs);
      const result = await repo.findActiveByUserIds(['u1', 'u2']);
      expect(result).toHaveLength(2);
    });
  });

  describe('updateLastUsed', () => {
    it('should skip update for empty array', async () => {
      await repo.updateLastUsed([]);
      expect(ormRepo.update).not.toHaveBeenCalled();
    });

    it('should update lastUsedAt for given ids', async () => {
      ormRepo.update.mockResolvedValue({ affected: 3, raw: [], generatedMaps: [] });
      await repo.updateLastUsed(['s1', 's2', 's3']);
      expect(ormRepo.update).toHaveBeenCalled();
    });
  });

  describe('deactivateByUserIdAndToken', () => {
    it('should mark subscription as inactive', async () => {
      ormRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      await repo.deactivateByUserIdAndToken('user-1', 'token-abc');
      expect(ormRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', deviceToken: 'token-abc' },
        { isActive: false },
      );
    });
  });
});
