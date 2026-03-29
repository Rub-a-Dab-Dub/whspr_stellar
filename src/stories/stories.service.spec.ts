jest.mock('../users/users.service', () => ({ UsersService: class UsersService {} }));

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { StoriesRepository } from './stories.repository';
import { UsersService } from '../users/users.service';
import { StoriesGateway } from './stories.gateway';
import { ContentType } from './entities/story.entity';
import { Story } from './entities/story.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('StoriesService', () => {
  let service: StoriesService;
  let repository: jest.Mocked<Pick<StoriesRepository, keyof StoriesRepository>>;
  let usersService: jest.Mocked<Pick<UsersService, 'findById'>>;
  let gateway: jest.Mocked<Pick<StoriesGateway, 'emitNewStoryToContactFeeds' | 'emitStoryViewCount'>>;

  const ownerDto = {
    id: 'owner-1',
    username: 'bob',
    avatarUrl: null as string | null,
    walletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  };

  const storyRow = (overrides: Partial<Story> = {}): Story =>
    ({
      id: 'story-1',
      userId: 'owner-1',
      contentType: ContentType.TEXT,
      content: 'hi',
      mediaUrl: null,
      backgroundColor: null,
      duration: 86400000,
      viewCount: 0,
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      user: { walletAddress: ownerDto.walletAddress } as Story['user'],
      ...overrides,
    }) as Story;

  beforeEach(() => {
    repository = {
      countActiveByUser: jest.fn(),
      createStory: jest.fn(),
      getContactUserIdsForCreatorWallet: jest.fn(),
      getContactStories: jest.fn(),
      getMyStories: jest.fn(),
      findActiveByIdWithAuthor: jest.fn(),
      isContactOfAuthor: jest.fn(),
      recordView: jest.fn(),
      findViewCountByStoryId: jest.fn(),
      findByIdAndUser: jest.fn(),
      deleteStory: jest.fn(),
      getViewers: jest.fn(),
      deleteExpired: jest.fn(),
    };

    usersService = {
      findById: jest.fn(),
    };

    gateway = {
      emitNewStoryToContactFeeds: jest.fn(),
      emitStoryViewCount: jest.fn(),
    };

    service = new StoriesService(
      repository as unknown as StoriesRepository,
      usersService as unknown as UsersService,
      gateway as unknown as StoriesGateway,
    );
  });

  describe('createStory', () => {
    it('rejects when payload invalid for TEXT', async () => {
      await expect(
        service.createStory('u1', {
          contentType: ContentType.TEXT,
          content: '   ',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when IMAGE without mediaUrl', async () => {
      await expect(
        service.createStory('u1', {
          contentType: ContentType.IMAGE,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when 30 active stories exist', async () => {
      repository.countActiveByUser.mockResolvedValue(30);
      await expect(
        service.createStory('u1', {
          contentType: ContentType.TEXT,
          content: 'ok',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates story, loads owner, and notifies contacts', async () => {
      repository.countActiveByUser.mockResolvedValue(0);
      const saved = storyRow();
      repository.createStory.mockResolvedValue(saved);
      repository.getContactUserIdsForCreatorWallet.mockResolvedValue(['c1', 'c2']);
      usersService.findById.mockResolvedValue(ownerDto as any);

      const dto = { contentType: ContentType.TEXT, content: 'hello' };
      const result = await service.createStory('owner-1', dto as any);

      expect(result.id).toBe('story-1');
      expect(result.username).toBe('bob');
      expect(gateway.emitNewStoryToContactFeeds).toHaveBeenCalledWith(
        ['c1', 'c2'],
        expect.objectContaining({ id: 'story-1' }),
      );
    });
  });

  describe('getContactStories', () => {
    it('maps stories with author profiles', async () => {
      const s = storyRow({ userId: 'author-1' });
      repository.getContactStories.mockResolvedValue({ stories: [s], total: 1 });
      usersService.findById.mockImplementation(async (id: string) => {
        if (id === 'author-1') {
          return { ...ownerDto, id: 'author-1', username: 'ann' } as any;
        }
        return ownerDto as any;
      });

      const out = await service.getContactStories('viewer-1', { page: 1, limit: 10 } as PaginationDto);
      expect(out.data).toHaveLength(1);
      expect(out.data[0].username).toBe('ann');
      expect(out.meta.total).toBe(1);
    });
  });

  describe('getMyStories', () => {
    it('includes viewer list per story', async () => {
      const s = storyRow();
      repository.getMyStories.mockResolvedValue([[s], 1]);
      usersService.findById.mockResolvedValue(ownerDto as any);
      repository.getViewers.mockResolvedValue([
        { storyId: s.id, viewerId: 'v1', viewedAt: new Date() },
      ] as any);

      const out = await service.getMyStories('owner-1', { page: 1, limit: 10 } as PaginationDto);
      expect(out.data[0].myViews).toEqual([
        expect.objectContaining({ viewerId: 'v1' }),
      ]);
    });
  });

  describe('viewStory', () => {
    it('throws when story missing', async () => {
      repository.findActiveByIdWithAuthor.mockResolvedValue(null);
      await expect(service.viewStory('sid', 'v1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns count for creator without recording view', async () => {
      const s = storyRow({ viewCount: 3 });
      repository.findActiveByIdWithAuthor.mockResolvedValue(s);
      repository.findViewCountByStoryId.mockResolvedValue(3);

      const out = await service.viewStory(s.id, 'owner-1');
      expect(out.viewCount).toBe(3);
      expect(repository.recordView).not.toHaveBeenCalled();
    });

    it('throws when viewer is not a contact', async () => {
      const s = storyRow();
      repository.findActiveByIdWithAuthor.mockResolvedValue(s);
      repository.isContactOfAuthor.mockResolvedValue(false);

      await expect(service.viewStory(s.id, 'stranger')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('records view and emits when new', async () => {
      const s = storyRow();
      repository.findActiveByIdWithAuthor.mockResolvedValue(s);
      repository.isContactOfAuthor.mockResolvedValue(true);
      repository.recordView.mockResolvedValue(5);

      const out = await service.viewStory(s.id, 'friend-1');
      expect(out.viewCount).toBe(5);
      expect(gateway.emitStoryViewCount).toHaveBeenCalledWith('owner-1', s.id, 5);
    });

    it('returns existing count when duplicate view', async () => {
      const s = storyRow({ viewCount: 7 });
      repository.findActiveByIdWithAuthor.mockResolvedValue(s);
      repository.isContactOfAuthor.mockResolvedValue(true);
      repository.recordView.mockResolvedValue(null);
      repository.findViewCountByStoryId.mockResolvedValue(7);

      const out = await service.viewStory(s.id, 'friend-1');
      expect(out.viewCount).toBe(7);
      expect(gateway.emitStoryViewCount).not.toHaveBeenCalled();
    });
  });

  describe('deleteStory', () => {
    it('throws when not owner', async () => {
      repository.findByIdAndUser.mockResolvedValue(null);
      await expect(service.deleteStory('sid', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes story', async () => {
      const s = storyRow();
      repository.findByIdAndUser.mockResolvedValue(s);
      await service.deleteStory(s.id, 'owner-1');
      expect(repository.deleteStory).toHaveBeenCalledWith(s);
    });
  });

  describe('getStoryViewers', () => {
    it('throws when not owner', async () => {
      repository.findByIdAndUser.mockResolvedValue(null);
      await expect(service.getStoryViewers('sid', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns viewers', async () => {
      repository.findByIdAndUser.mockResolvedValue(storyRow());
      repository.getViewers.mockResolvedValue([
        { storyId: 'story-1', viewerId: 'v1', viewedAt: new Date('2020-01-01') },
      ] as any);

      const rows = await service.getStoryViewers('story-1', 'owner-1');
      expect(rows).toEqual([{ viewerId: 'v1', viewedAt: expect.any(Date) }]);
    });
  });

  describe('deleteExpired', () => {
    it('delegates to repository', async () => {
      repository.deleteExpired.mockResolvedValue(2);
      await expect(service.deleteExpired()).resolves.toBe(2);
    });
  });
});
