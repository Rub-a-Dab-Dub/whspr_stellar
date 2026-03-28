import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let service: PresenceService;
  let pipeline: Record<string, jest.Mock>;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(async () => {
    pipeline = {
      set: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    mockRedis = {
      pipeline: jest.fn().mockReturnValue(pipeline),
      exists: jest.fn(),
      smembers: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get(PresenceService);
  });

  describe('setOnline', () => {
    it('stores socket ID and adds user to online set', async () => {
      await service.setOnline('user-1', 'socket-1');
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(pipeline.set).toHaveBeenCalledWith(
        'presence:socket:user-1',
        'socket-1',
        'EX',
        expect.any(Number),
      );
      expect(pipeline.sadd).toHaveBeenCalledWith('presence:online', 'user-1');
      expect(pipeline.exec).toHaveBeenCalled();
    });
  });

  describe('setOffline', () => {
    it('removes socket key and removes user from online set', async () => {
      await service.setOffline('user-1');
      expect(pipeline.del).toHaveBeenCalledWith('presence:socket:user-1');
      expect(pipeline.del).toHaveBeenCalledWith('presence:ts:user-1');
      expect(pipeline.srem).toHaveBeenCalledWith('presence:online', 'user-1');
      expect(pipeline.exec).toHaveBeenCalled();
    });
  });

  describe('isOnline', () => {
    it('returns true when presence key exists in Redis', async () => {
      mockRedis.exists.mockResolvedValue(1);
      expect(await service.isOnline('user-1')).toBe(true);
    });

    it('returns false when presence key is absent', async () => {
      mockRedis.exists.mockResolvedValue(0);
      expect(await service.isOnline('user-1')).toBe(false);
    });
  });

  describe('getOnlineUsers', () => {
    it('returns members of the online set', async () => {
      mockRedis.smembers.mockResolvedValue(['user-1', 'user-2']);
      expect(await service.getOnlineUsers()).toEqual(['user-1', 'user-2']);
    });

    it('returns empty array when no users are online', async () => {
      mockRedis.smembers.mockResolvedValue([]);
      expect(await service.getOnlineUsers()).toEqual([]);
    });
  });

  describe('getSocketId', () => {
    it('returns the stored socket ID for a user', async () => {
      mockRedis.get.mockResolvedValue('socket-abc');
      expect(await service.getSocketId('user-1')).toBe('socket-abc');
    });

    it('returns null when user has no active socket', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await service.getSocketId('user-1')).toBeNull();
    });
  });

  describe('refreshPresence', () => {
    it('calls setOnline when socket ID exists', async () => {
      mockRedis.get.mockResolvedValue('socket-1');
      const setOnline = jest.spyOn(service, 'setOnline').mockResolvedValue();
      await service.refreshPresence('user-1');
      expect(setOnline).toHaveBeenCalledWith('user-1', 'socket-1');
    });

    it('does nothing when user has no active socket', async () => {
      mockRedis.get.mockResolvedValue(null);
      const setOnline = jest.spyOn(service, 'setOnline');
      await service.refreshPresence('user-1');
      expect(setOnline).not.toHaveBeenCalled();
    });
  });
});
