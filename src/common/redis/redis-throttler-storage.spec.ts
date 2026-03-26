import { RedisThrottlerStorage } from './redis-throttler-storage';

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      multi: jest.fn().mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], // zremrangebyscore
          [null, 1], // zadd
          [null, 5], // zcard
          [null, 1], // expire
        ]),
      }),
    };
    storage = new RedisThrottlerStorage(mockRedis);
  });

  it('should increment and return hits', async () => {
    const result = await storage.increment('test-key', 60000);
    expect(result.totalHits).toBe(5);
    expect(result.timeToExpire).toBe(60);
    expect(mockRedis.multi).toHaveBeenCalled();
  });
});
