import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserBadge } from './entities/user-badge.entity';
import { UserBadgeRepository } from './user-badge.repository';

const mockOrm = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('UserBadgeRepository', () => {
  let repo: UserBadgeRepository;
  let orm: ReturnType<typeof mockOrm>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserBadgeRepository,
        { provide: getRepositoryToken(UserBadge), useFactory: mockOrm },
      ],
    }).compile();

    repo = module.get(UserBadgeRepository);
    orm = module.get(getRepositoryToken(UserBadge));
  });

  it('award returns null when badge already exists (idempotent)', async () => {
    orm.findOne.mockResolvedValue({ id: 'existing' });
    const result = await repo.award('u1', 'b1');
    expect(result).toBeNull();
    expect(orm.save).not.toHaveBeenCalled();
  });

  it('award saves new record when not yet awarded', async () => {
    const newUb = { id: 'new-ub' } as UserBadge;
    orm.findOne.mockResolvedValue(null);
    orm.create.mockReturnValue(newUb);
    orm.save.mockResolvedValue(newUb);
    const result = await repo.award('u1', 'b1');
    expect(result).toBe(newUb);
    expect(orm.save).toHaveBeenCalled();
  });

  it('findByUser queries with correct where and order', async () => {
    orm.find.mockResolvedValue([]);
    await repo.findByUser('u1');
    expect(orm.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });

  it('updateDisplayed calls update then queryBuilder', async () => {
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    orm.update.mockResolvedValue({});
    orm.createQueryBuilder.mockReturnValue(qb);

    await repo.updateDisplayed('u1', ['b1', 'b2']);
    expect(orm.update).toHaveBeenCalledWith({ userId: 'u1' }, { isDisplayed: false });
    expect(qb.execute).toHaveBeenCalled();
  });

  it('updateDisplayed skips queryBuilder when badgeIds is empty', async () => {
    orm.update.mockResolvedValue({});
    await repo.updateDisplayed('u1', []);
    expect(orm.createQueryBuilder).not.toHaveBeenCalled();
  });
});
