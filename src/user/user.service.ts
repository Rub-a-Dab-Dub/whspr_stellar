import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { UserSearchResultDto } from './dto/search-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.findOne(id);
    user.role = role;
    return this.userRepository.save(user);
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = isActive;
    return this.userRepository.save(user);
  }

  async searchUsers(query: string): Promise<UserSearchResultDto[]> {
    const trimmedQuery = query.trim();
    const results = await this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.username',
        'user.avatarUrl',
        'user.level',
        'user.isOnline',
        'user.walletAddress',
      ])
      .where('user.deletedAt IS NULL')
      .andWhere('user.isBanned = false')
      .andWhere('user.suspendedUntil IS NULL OR user.suspendedUntil < NOW()')
      .andWhere(
        '(user.username ILIKE :query OR user.walletAddress ILIKE :walletQuery OR similarity(user.username, :rawQuery) > 0.3)',
        {
          query: `%${trimmedQuery}%`,
          walletQuery: `${trimmedQuery}%`,
          rawQuery: trimmedQuery
        },
      )
      .orderBy(
        'CASE WHEN user.username ILIKE :exactQuery THEN 1 WHEN user.walletAddress ILIKE :exactWalletQuery THEN 2 ELSE 3 END',
        'ASC'
      )
      .addOrderBy('similarity(user.username, :rawQuery)', 'DESC')
      .addOrderBy('user.level', 'DESC')
      .addOrderBy('user.isOnline', 'DESC')
      .setParameter('exactQuery', trimmedQuery)
      .setParameter('exactWalletQuery', `${trimmedQuery}%`)
      .setParameter('rawQuery', trimmedQuery)
      .limit(20)
      .getMany();

    return results.map((user) => ({
      id: user.id,
      username: user.username ?? '',
      avatarUrl: user.avatarUrl,
      level: user.level,
      isOnline: user.isOnline,
    }));
  }

  async addXP(userId: string, amount: number): Promise<void> {
    await this.userRepository.increment({ id: userId }, 'xp', amount);
  }
}
