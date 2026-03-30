import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../common/redis/redis.service';
import { BlockEnforcementRepository } from './block-enforcement.repository';
import { UserSettingsService } from '../user-settings/user-settings.service';

const BLOCK_CACHE_TTL_SECONDS = 60;

@Injectable()
export class BlockEnforcementService {
  constructor(
    private readonly repo: BlockEnforcementRepository,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userSettingsService: UserSettingsService,
  ) {}

  private blockCacheKey(blockerId: string, blockedId: string): string {
    return `block:${blockerId}:${blockedId}`;
  }

  private async cacheBlockStatus(blockerId: string, blockedId: string, isBlocked: boolean): Promise<void> {
    const key = this.blockCacheKey(blockerId, blockedId);
    await this.redisService.getClient().set(key, isBlocked ? '1' : '0', 'EX', BLOCK_CACHE_TTL_SECONDS);
  }

  private async getCacheBlockStatus(blockerId: string, blockedId: string): Promise<boolean | null> {
    const key = this.blockCacheKey(blockerId, blockedId);
    const cached = await this.redisService.getClient().get(key);
    if (cached === '1') return true;
    if (cached === '0') return false;
    return null;
  }

  private async invalidateBlockCache(blockerId: string, blockedId: string): Promise<void> {
    const client = this.redisService.getClient();
    await client.del(this.blockCacheKey(blockerId, blockedId));
    await client.del(this.blockCacheKey(blockedId, blockerId));
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const alreadyBlocked = await this.repo.isBlocked(blockerId, blockedId);
    if (alreadyBlocked) {
      return;
    }

    await this.repo.createBlock(blockerId, blockedId);
    await this.invalidateBlockCache(blockerId, blockedId);
    await this.cacheBlockStatus(blockerId, blockedId, true);
    this.eventEmitter.emit('user:blocked', { blockerId, blockedId });
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const blocked = await this.repo.isBlocked(blockerId, blockedId);
    if (!blocked) {
      throw new BadRequestException('Block does not exist');
    }

    await this.repo.removeBlock(blockerId, blockedId);
    await this.invalidateBlockCache(blockerId, blockedId);
    this.eventEmitter.emit('user:unblocked', { blockerId, blockedId });
  }

  async getBlockedUsers(blockerId: string): Promise<string[]> {
    const blocks = await this.repo.getBlockedUsers(blockerId);
    return blocks.map((b) => b.blockedId);
  }

  async getBlockedByCount(userId: string): Promise<number> {
    return this.repo.getBlockedByCount(userId);
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    if (blockerId === blockedId) {
      return false;
    }
    const cached = await this.getCacheBlockStatus(blockerId, blockedId);
    if (cached !== null) {
      return cached;
    }
    const blocked = await this.repo.isBlocked(blockerId, blockedId);
    await this.cacheBlockStatus(blockerId, blockedId, blocked);
    return blocked;
  }

  async isBlockedEither(userA: string, userB: string): Promise<boolean> {
    if (userA === userB) {
      return false;
    }

    const [aToB, bToA] = await Promise.all([
      this.isBlocked(userA, userB),
      this.isBlocked(userB, userA),
    ]);

    return aToB || bToA;
  }

  async canSendMessage(senderId: string, recipientIds: string[]): Promise<void> {
    for (const recipientId of recipientIds) {
      if (await this.isBlockedEither(senderId, recipientId)) {
        throw new ForbiddenException('Cannot send message due to block status');
      }
    }
  }

  async canTransferFunds(senderId: string, recipientIds: string[]): Promise<void> {
    for (const recipientId of recipientIds) {
      if (await this.isBlockedEither(senderId, recipientId)) {
        throw new ForbiddenException('Cannot transfer to blocked user');
      }
    }
  }

  async canViewProfile(viewerId: string, targetId: string): Promise<void> {
    if (viewerId === targetId) {
      return;
    }

    if (await this.isBlockedEither(viewerId, targetId)) {
      throw new ForbiddenException('Profile is not accessible due to block status');
    }

    const privacy = await this.userSettingsService.getPrivacySettings(targetId);
    if (privacy.lastSeenVisibility === 'nobody') {
      // profile should still be accessible, but last-seen data suppressed by UsersService
      return;
    }

    if (privacy.lastSeenVisibility === 'contacts') {
      // TODO: Replace with actual contacts check once integrated. For now we deny for non-self.
      throw new ForbiddenException('Profile visibility is contacts-only');
    }
  }

  async shouldApplyReadReceipt(userId: string): Promise<boolean> {
    const privacy = await this.userSettingsService.getPrivacySettings(userId);
    return privacy.readReceiptsEnabled;
  }

  async enforceOnlineVisibility(targetId: string): Promise<boolean> {
    const privacy = await this.userSettingsService.getPrivacySettings(targetId);
    return privacy.onlineStatusVisible;
  }
}
