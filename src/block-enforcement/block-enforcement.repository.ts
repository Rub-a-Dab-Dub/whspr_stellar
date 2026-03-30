import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBlock } from './entities/user-block.entity';

@Injectable()
export class BlockEnforcementRepository {
  constructor(
    @InjectRepository(UserBlock)
    private readonly repo: Repository<UserBlock>,
  ) {}

  async createBlock(blockerId: string, blockedId: string): Promise<UserBlock> {
    const block = this.repo.create({ blockerId, blockedId });
    return this.repo.save(block);
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<void> {
    await this.repo.delete({ blockerId, blockedId });
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const count = await this.repo.count({ where: { blockerId, blockedId } });
    return count > 0;
  }

  async isBlockedEither(userA: string, userB: string): Promise<boolean> {
    const count = await this.repo.count({
      where: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    });
    return count > 0;
  }

  async getBlockedUsers(blockerId: string): Promise<UserBlock[]> {
    return this.repo.find({ where: { blockerId } });
  }

  async getBlockedByCount(blockedId: string): Promise<number> {
    return this.repo.count({ where: { blockedId } });
  }
}
