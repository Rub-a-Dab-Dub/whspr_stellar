import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserConsent } from './entities/user-consent.entity';
import { UserConsentRepository } from './user-consent.repository';

const mockOrm = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
});

describe('UserConsentRepository', () => {
  let repo: UserConsentRepository;
  let orm: ReturnType<typeof mockOrm>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserConsentRepository,
        { provide: getRepositoryToken(UserConsent), useFactory: mockOrm },
      ],
    }).compile();

    repo = module.get(UserConsentRepository);
    orm = module.get(getRepositoryToken(UserConsent));
  });

  it('upsert returns existing record without saving again', async () => {
    const existing = { id: 'c1', userId: 'u1', documentId: 'd1' } as UserConsent;
    orm.findOne.mockResolvedValue(existing);

    const result = await repo.upsert({ userId: 'u1', documentId: 'd1' } as UserConsent);
    expect(result).toBe(existing);
    expect(orm.save).not.toHaveBeenCalled();
  });

  it('upsert saves when no existing record', async () => {
    const newConsent = { id: 'c2', userId: 'u1', documentId: 'd1' } as UserConsent;
    orm.findOne.mockResolvedValue(null);
    orm.save.mockResolvedValue(newConsent);

    const result = await repo.upsert({ userId: 'u1', documentId: 'd1' } as UserConsent);
    expect(result).toBe(newConsent);
    expect(orm.save).toHaveBeenCalled();
  });

  it('findAllByUser queries with relations and order', async () => {
    orm.find.mockResolvedValue([]);
    await repo.findAllByUser('u1');
    expect(orm.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        relations: ['document'],
      }),
    );
  });
});
