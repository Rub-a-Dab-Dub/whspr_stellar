import { Test, TestingModule } from '@nestjs/testing';
import { ActivityFeedService } from './activity-feed.service';
import { ActivityFeedRepository } from '../repositories/activity-feed.repository';
import { ActivityFeedGateway } from '../gateway/activity-feed.gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityType } from '../constants/activity-types';

const USER_ID = 'user-uuid-1';
const ACTOR_ID = 'actor-uuid-2';
const ITEM_ID = 'item-uuid-3';

const baseItem = () => ({
  id: ITEM_ID,
  userId: USER_ID,
  actorId: ACTOR_ID,
  activityType: ActivityType.TRANSFER_RECEIVED,
  resourceType: 'payment',
  resourceId: 'payment-1',
  metadata: { amount: '10' },
  isRead: false,
  createdAt: new Date(),
});

describe('ActivityFeedService', () => {
  let service: ActivityFeedService;
  let repo: jest.Mocked<ActivityFeedRepository>;
  let gateway: jest.Mocked<ActivityFeedGateway>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityFeedService,
        {
          provide: ActivityFeedRepository,
          useValue: {
            create: jest.fn(),
            findFeed: jest.fn(),
            markRead: jest.fn(),
            markAllRead: jest.fn(),
            getUnreadCount: jest.fn(),
            deleteItem: jest.fn(),
          },
        },
        {
          provide: ActivityFeedGateway,
          useValue: { emitToUser: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ActivityFeedService);
    repo = module.get(ActivityFeedRepository) as jest.Mocked<ActivityFeedRepository>;
    gateway = module.get(ActivityFeedGateway) as jest.Mocked<ActivityFeedGateway>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  describe('publishActivity', () => {
    it('saves item, emits event, and pushes via gateway', async () => {
      const item = baseItem();
      repo.create.mockResolvedValue(item as any);

      const result = await service.publishActivity({
        userId: USER_ID,
        actorId: ACTOR_ID,
        activityType: ActivityType.TRANSFER_RECEIVED,
        resourceType: 'payment',
        resourceId: 'payment-1',
        metadata: { amount: '10' },
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, actorId: ACTOR_ID }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('activity.created', item);
      expect(gateway.emitToUser).toHaveBeenCalledWith(USER_ID, item);
      expect(result.id).toBe(ITEM_ID);
    });

    it('works without optional resourceId and metadata', async () => {
      const item = { ...baseItem(), resourceId: undefined, metadata: undefined };
      repo.create.mockResolvedValue(item as any);

      await service.publishActivity({
        userId: USER_ID,
        actorId: ACTOR_ID,
        activityType: ActivityType.CONTACT_ACCEPTED,
        resourceType: 'contact',
      });

      expect(repo.create).toHaveBeenCalled();
      expect(gateway.emitToUser).toHaveBeenCalledWith(USER_ID, item);
    });
  });

  describe('getFeed', () => {
    it('returns paginated feed from repository', async () => {
      const feedResult = { data: [baseItem()], nextCursor: null };
      repo.findFeed.mockResolvedValue(feedResult as any);

      const result = await service.getFeed(USER_ID);

      expect(repo.findFeed).toHaveBeenCalledWith(USER_ID, undefined);
      expect(result.data).toHaveLength(1);
    });

    it('passes cursor to repository when provided', async () => {
      repo.findFeed.mockResolvedValue({ data: [], nextCursor: null });
      const cursor = new Date().toISOString();

      await service.getFeed(USER_ID, cursor);

      expect(repo.findFeed).toHaveBeenCalledWith(USER_ID, cursor);
    });
  });

  describe('markRead', () => {
    it('delegates to repository with correct arg order', async () => {
      repo.markRead.mockResolvedValue({ affected: 1 } as any);

      await service.markRead(USER_ID, ITEM_ID);

      expect(repo.markRead).toHaveBeenCalledWith(ITEM_ID, USER_ID);
    });
  });

  describe('markAllRead', () => {
    it('marks all unread items for user', async () => {
      repo.markAllRead.mockResolvedValue({ affected: 3 } as any);

      await service.markAllRead(USER_ID);

      expect(repo.markAllRead).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('getUnreadCount', () => {
    it('returns count from repository', async () => {
      repo.getUnreadCount.mockResolvedValue(5);

      const result = await service.getUnreadCount(USER_ID);

      expect(result).toBe(5);
    });

    it('returns 0 when no unread items', async () => {
      repo.getUnreadCount.mockResolvedValue(0);

      const result = await service.getUnreadCount(USER_ID);

      expect(result).toBe(0);
    });
  });

  describe('deleteItem', () => {
    it('delegates to repository with correct arg order', async () => {
      repo.deleteItem.mockResolvedValue({ affected: 1 } as any);

      await service.deleteItem(USER_ID, ITEM_ID);

      expect(repo.deleteItem).toHaveBeenCalledWith(ITEM_ID, USER_ID);
    });
  });
});
