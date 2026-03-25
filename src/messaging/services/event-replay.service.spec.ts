import { Test, TestingModule } from '@nestjs/testing';
import { EventReplayService, StoredEvent } from './event-replay.service';

const makeRaw = (overrides: Partial<StoredEvent>): string =>
  JSON.stringify({
    event: 'message:new',
    data: {},
    timestamp: 1000,
    roomId: 'room-1',
    ...overrides,
  });

describe('EventReplayService', () => {
  let service: EventReplayService;
  let pipeline: Record<string, jest.Mock>;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(async () => {
    pipeline = {
      rpush: jest.fn().mockReturnThis(),
      ltrim: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    mockRedis = {
      pipeline: jest.fn().mockReturnValue(pipeline),
      lrange: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventReplayService,
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get(EventReplayService);
  });

  describe('storeEvent', () => {
    it('appends event to Redis list with a trim and TTL', async () => {
      await service.storeEvent('room-1', 'message:new', { content: 'hello' });
      expect(pipeline.rpush).toHaveBeenCalledWith(
        'events:room-1',
        expect.stringContaining('"event":"message:new"'),
      );
      expect(pipeline.ltrim).toHaveBeenCalledWith('events:room-1', -50, -1);
      expect(pipeline.expire).toHaveBeenCalledWith('events:room-1', 3600);
      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('serialises the data payload correctly', async () => {
      const data = { messageId: 'abc', senderId: 'user-1' };
      await service.storeEvent('room-2', 'reaction:new', data);
      const [, json] = pipeline.rpush.mock.calls[0];
      const parsed: StoredEvent = JSON.parse(json as string);
      expect(parsed.event).toBe('reaction:new');
      expect(parsed.data).toEqual(data);
      expect(typeof parsed.timestamp).toBe('number');
    });
  });

  describe('getMissedEvents', () => {
    it('returns events whose timestamp is strictly after `since`', async () => {
      mockRedis.lrange.mockResolvedValue([
        makeRaw({ timestamp: 1000 }),
        makeRaw({ timestamp: 2000 }),
        makeRaw({ timestamp: 3000 }),
      ]);
      const result = await service.getMissedEvents('room-1', 1500);
      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toBe(2000);
      expect(result[1].timestamp).toBe(3000);
    });

    it('returns all events when since=0', async () => {
      mockRedis.lrange.mockResolvedValue([
        makeRaw({ timestamp: 100 }),
        makeRaw({ timestamp: 200 }),
      ]);
      expect(await service.getMissedEvents('room-1', 0)).toHaveLength(2);
    });

    it('returns empty array when all events are older than since', async () => {
      mockRedis.lrange.mockResolvedValue([makeRaw({ timestamp: 500 })]);
      expect(await service.getMissedEvents('room-1', 1000)).toHaveLength(0);
    });

    it('returns empty array when the room has no stored events', async () => {
      mockRedis.lrange.mockResolvedValue([]);
      expect(await service.getMissedEvents('room-1', 0)).toHaveLength(0);
    });
  });

  describe('getRecentEvents', () => {
    it('queries the Redis list with the requested limit', async () => {
      mockRedis.lrange.mockResolvedValue([makeRaw({}), makeRaw({})]);
      const result = await service.getRecentEvents('room-1', 10);
      expect(mockRedis.lrange).toHaveBeenCalledWith('events:room-1', -10, -1);
      expect(result).toHaveLength(2);
    });

    it('defaults to 50 most-recent events', async () => {
      mockRedis.lrange.mockResolvedValue([]);
      await service.getRecentEvents('room-1');
      expect(mockRedis.lrange).toHaveBeenCalledWith('events:room-1', -50, -1);
    });
  });
});
