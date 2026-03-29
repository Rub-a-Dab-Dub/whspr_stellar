import { DataSource } from 'typeorm';
import { StoriesRepository } from './stories.repository';
import { ContentType, Story } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { CreateStoryDto } from './dto/create-story.dto';

describe('StoriesRepository', () => {
  let repository: StoriesRepository;
  let storyRepo: any;
  let viewRepo: any;
  let dataSource: any;

  const qbMock = (result: unknown) => {
    const qb: any = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(result),
      getCount: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    return qb;
  };

  beforeEach(() => {
    storyRepo = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'new-id', ...x })),
      count: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    viewRepo = {
      find: jest.fn(),
    };

    dataSource = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Story) return storyRepo;
        if (entity === StoryView) return viewRepo;
        throw new Error('unexpected entity');
      }),
      query: jest.fn(),
    };

    repository = new StoriesRepository(dataSource as DataSource);
  });

  describe('createStory', () => {
    it('persists story with default 24h window', async () => {
      const dto: CreateStoryDto = { contentType: ContentType.TEXT, content: 'a' };
      await repository.createStory('u1', dto);

      expect(storyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          contentType: ContentType.TEXT,
          content: 'a',
          duration: 86400000,
        }),
      );
      expect(storyRepo.save).toHaveBeenCalled();
    });
  });

  describe('countActiveByUser', () => {
    it('counts non-expired for user', async () => {
      storyRepo.count.mockResolvedValue(4);
      await expect(repository.countActiveByUser('u1')).resolves.toBe(4);
      expect(storyRepo.count).toHaveBeenCalled();
    });
  });

  describe('getMyStories', () => {
    it('paginates', async () => {
      storyRepo.findAndCount.mockResolvedValue([[], 0]);
      await repository.getMyStories('u1', { page: 2, limit: 5 });
      expect(storyRepo.findAndCount).toHaveBeenCalled();
    });
  });

  describe('getContactStories', () => {
    it('returns empty when no friend wallets', async () => {
      dataSource.query.mockResolvedValueOnce([]);
      const out = await repository.getContactStories('v1', { page: 1, limit: 10 });
      expect(out).toEqual({ stories: [], total: 0 });
    });

    it('queries stories when friends exist', async () => {
      dataSource.query.mockResolvedValueOnce([{ walletAddress: 'G' + 'A'.repeat(55) }]);
      const qbRows = qbMock([{ id: 's1' }]);
      const qbTotal = qbMock([]);
      qbTotal.getCount = jest.fn().mockResolvedValue(5);
      storyRepo.createQueryBuilder
        .mockReturnValueOnce(qbRows)
        .mockReturnValueOnce(qbTotal);

      const out = await repository.getContactStories('v1', { page: 1, limit: 10 });
      expect(out.stories).toEqual([{ id: 's1' }]);
      expect(out.total).toBe(5);
      expect(qbRows.andWhere).toHaveBeenCalledWith('story.userId != :viewerId', { viewerId: 'v1' });
    });
  });

  describe('recordView', () => {
    it('returns parsed count from SQL', async () => {
      dataSource.query.mockResolvedValueOnce([{ viewCount: '5' }]);
      await expect(repository.recordView('s1', 'v1')).resolves.toBe(5);
    });

    it('returns null when no new insert', async () => {
      dataSource.query.mockResolvedValueOnce([]);
      await expect(repository.recordView('s1', 'v1')).resolves.toBeNull();
    });
  });

  describe('isContactOfAuthor', () => {
    it('returns boolean from query', async () => {
      dataSource.query.mockResolvedValueOnce([{ x: 1 }]);
      await expect(repository.isContactOfAuthor('v1', '0xw')).resolves.toBe(true);

      dataSource.query.mockResolvedValueOnce([]);
      await expect(repository.isContactOfAuthor('v1', '0xw')).resolves.toBe(false);
    });
  });

  describe('getContactUserIdsForCreatorWallet', () => {
    it('maps rows', async () => {
      dataSource.query.mockResolvedValueOnce([{ userId: 'a' }, { userId: 'b' }]);
      await expect(repository.getContactUserIdsForCreatorWallet('0xw')).resolves.toEqual(['a', 'b']);
    });
  });

  describe('deleteExpired', () => {
    it('returns affected count', async () => {
      storyRepo.delete.mockResolvedValue({ affected: 3, raw: [] });
      await expect(repository.deleteExpired()).resolves.toBe(3);
    });
  });

  describe('getViewers', () => {
    it('loads ordered views', async () => {
      viewRepo.find.mockResolvedValue([]);
      await repository.getViewers('s1');
      expect(viewRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { storyId: 's1' } }),
      );
    });
  });

  describe('findViewCountByStoryId', () => {
    it('returns count or null', async () => {
      storyRepo.findOne.mockResolvedValue({ viewCount: 9 });
      await expect(repository.findViewCountByStoryId('s1')).resolves.toBe(9);

      storyRepo.findOne.mockResolvedValue(null);
      await expect(repository.findViewCountByStoryId('s1')).resolves.toBeNull();
    });
  });

  describe('findActiveByIdWithAuthor', () => {
    it('delegates to findOne', async () => {
      storyRepo.findOne.mockResolvedValue(null);
      await repository.findActiveByIdWithAuthor('s1');
      expect(storyRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['user'] }),
      );
    });
  });

  describe('findByIdAndUser', () => {
    it('delegates to findOne', async () => {
      await repository.findByIdAndUser('s1', 'u1');
      expect(storyRepo.findOne).toHaveBeenCalledWith({ where: { id: 's1', userId: 'u1' } });
    });
  });

  describe('deleteStory', () => {
    it('removes entity', async () => {
      const s = { id: 's1' } as Story;
      await repository.deleteStory(s);
      expect(storyRepo.remove).toHaveBeenCalledWith(s);
    });
  });
});
