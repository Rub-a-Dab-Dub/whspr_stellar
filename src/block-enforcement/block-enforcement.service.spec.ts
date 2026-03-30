import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BlockEnforcementRepository } from './block-enforcement.repository';
import { BlockEnforcementService } from './block-enforcement.service';
import { RedisService } from '../common/redis/redis.service';
import { UserSettingsService } from '../user-settings/user-settings.service';

describe('BlockEnforcementService', () => {
  let repo: jest.Mocked<BlockEnforcementRepository>;
  let redisClient: any;
  let redisService: jest.Mocked<RedisService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let userSettingsService: jest.Mocked<UserSettingsService>;
  let service: BlockEnforcementService;

  beforeEach(() => {
    repo = {
      createBlock: jest.fn(),
      removeBlock: jest.fn(),
      isBlocked: jest.fn(),
      isBlockedEither: jest.fn(),
      getBlockedUsers: jest.fn(),
      getBlockedByCount: jest.fn(),
    } as unknown as jest.Mocked<BlockEnforcementRepository>;

    redisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
    } as unknown as jest.Mocked<RedisService>;

    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    userSettingsService = {
      getPrivacySettings: jest.fn().mockResolvedValue({
        lastSeenVisibility: 'everyone',
        readReceiptsEnabled: true,
        onlineStatusVisible: true,
      }),
      ensureSettingsForUser: jest.fn(),
      getSettings: jest.fn(),
      updateSettings: jest.fn(),
      resetSettings: jest.fn(),
      isNotificationEnabled: jest.fn(),
    } as unknown as jest.Mocked<UserSettingsService>;

    service = new BlockEnforcementService(repo, redisService, eventEmitter, userSettingsService);
  });

  it('blocks a user and emits event', async () => {
    repo.isBlocked.mockResolvedValue(false);
    repo.createBlock.mockResolvedValue({ id: '1', blockerId: 'a', blockedId: 'b', createdAt: new Date() } as any);

    await service.blockUser('a', 'b');

    expect(repo.createBlock).toHaveBeenCalledWith('a', 'b');
    expect(redisClient.set).toHaveBeenCalledWith('block:a:b', '1', 'EX', 60);
    expect(eventEmitter.emit).toHaveBeenCalledWith('user:blocked', { blockerId: 'a', blockedId: 'b' });
  });

  it('throws when blocking yourself', async () => {
    await expect(service.blockUser('a', 'a')).rejects.toThrow(BadRequestException);
  });

  it('unblocks a user and emits event', async () => {
    repo.isBlocked.mockResolvedValue(true);

    await service.unblockUser('a', 'b');

    expect(repo.removeBlock).toHaveBeenCalledWith('a', 'b');
    expect(eventEmitter.emit).toHaveBeenCalledWith('user:unblocked', { blockerId: 'a', blockedId: 'b' });
  });

  it('throws when unblocking non-blocked user', async () => {
    repo.isBlocked.mockResolvedValue(false);
    await expect(service.unblockUser('a', 'b')).rejects.toThrow(BadRequestException);
  });

  it('returns cached blocked status', async () => {
    redisClient.get.mockResolvedValue('1');

    const result = await service.isBlocked('a', 'b');

    expect(result).toBe(true);
    expect(repo.isBlocked).not.toHaveBeenCalled();
  });

  it('supports canSendMessage for blocked recipients', async () => {
    jest.spyOn(service, 'isBlockedEither').mockResolvedValue(true);

    await expect(service.canSendMessage('a', ['b'])).rejects.toThrow(ForbiddenException);
  });
});
