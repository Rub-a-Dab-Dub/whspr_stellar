import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PushSubscription, Platform } from '../entities/push-subscription.entity';

@Injectable()
export class PushSubscriptionsRepository {
  constructor(
    @InjectRepository(PushSubscription)
    private readonly repo: Repository<PushSubscription>,
  ) {}

  async findById(id: string): Promise<PushSubscription | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByUserIdAndToken(
    userId: string,
    deviceToken: string,
  ): Promise<PushSubscription | null> {
    return this.repo.findOne({ where: { userId, deviceToken } });
  }

  async findActiveByUserId(userId: string): Promise<PushSubscription[]> {
    return this.repo.find({ where: { userId, isActive: true } });
  }

  async findActiveByUserIds(userIds: string[]): Promise<PushSubscription[]> {
    if (!userIds.length) return [];
    return this.repo.find({ where: { userId: In(userIds), isActive: true } });
  }

  async findByToken(deviceToken: string): Promise<PushSubscription | null> {
    return this.repo.findOne({ where: { deviceToken } });
  }

  async upsert(
    userId: string,
    deviceToken: string,
    platform: Platform,
  ): Promise<{ subscription: PushSubscription; isNew: boolean }> {
    const existing = await this.findByUserIdAndToken(userId, deviceToken);
    if (existing) {
      existing.isActive = true;
      existing.lastUsedAt = new Date();
      const saved = await this.repo.save(existing);
      return { subscription: saved, isNew: false };
    }

    const subscription = this.repo.create({
      userId,
      deviceToken,
      platform,
      isActive: true,
      lastUsedAt: new Date(),
    });
    const saved = await this.repo.save(subscription);
    return { subscription: saved, isNew: true };
  }

  async deactivateByToken(deviceToken: string): Promise<void> {
    await this.repo.update({ deviceToken }, { isActive: false });
  }

  async deactivateByUserIdAndToken(
    userId: string,
    deviceToken: string,
  ): Promise<void> {
    await this.repo.update({ userId, deviceToken }, { isActive: false });
  }

  async removeInvalidTokens(tokens: string[]): Promise<number> {
    if (!tokens.length) return 0;
    const result = await this.repo.delete({ deviceToken: In(tokens) });
    return result.affected ?? 0;
  }

  async updateLastUsed(tokenIds: string[]): Promise<void> {
    if (!tokenIds.length) return;
    await this.repo.update(
      { id: In(tokenIds) },
      { lastUsedAt: new Date() },
    );
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, isActive: true } });
  }

  async findAll(userId: string): Promise<PushSubscription[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }
}
