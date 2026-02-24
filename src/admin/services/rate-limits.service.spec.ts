import { RateLimitsService } from './rate-limits.service';

describe('RateLimitsService', () => {
  let service: RateLimitsService;
  let mockRedis: any;
  let mockAudit: any;
  let mockConfig: any;

  beforeEach(() => {
    mockRedis = {
      keys: jest.fn(),
      getInt: jest.fn(),
      ttl: jest.fn(),
      del: jest.fn(),
    };

    mockAudit = { createAuditLog: jest.fn().mockResolvedValue({}) };

    mockConfig = { get: jest.fn().mockReturnValue(undefined) };

    service = new RateLimitsService(mockRedis, mockAudit, mockConfig as any);
  });

  it('resolves user buckets from redis keys', async () => {
    mockRedis.keys.mockResolvedValue(['throttle:message_send:user-123', 'throttle:tip_action:user-123']);
    mockRedis.getInt.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
    mockRedis.ttl.mockResolvedValueOnce(30).mockResolvedValueOnce(-1);

    const buckets = await service.getUserBuckets('user-123');
    expect(mockRedis.keys).toHaveBeenCalledWith('*user-123*');
    expect(buckets.length).toBe(2);
    const msBucket = buckets.find((b) => b.key.includes('message_send'))!;
    expect(msBucket.currentCount).toBe(3);
    expect(msBucket.resetsAt).not.toBeNull();
  });

  it('deletes all user keys and writes audit logs', async () => {
    mockRedis.keys.mockResolvedValue(['k1', 'k2']);
    mockRedis.del.mockResolvedValue(undefined);

    const res = await service.resetAllUserBuckets('u1', 'actor-1', 'test-reason');
    expect(mockRedis.keys).toHaveBeenCalledWith('*u1*');
    expect(mockRedis.del).toHaveBeenCalledTimes(2);
    expect(mockAudit.createAuditLog).toHaveBeenCalledTimes(2);
    expect(res.deleted).toBe(2);
  });
});
