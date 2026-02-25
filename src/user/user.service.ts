import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserSearchResultDto } from './dto/search-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

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
      username: user.username,
      avatarUrl: user.avatarUrl,
      level: user.level,
      isOnline: user.isOnline,
    }));
  }

  async addXP(userId: string, amount: number): Promise<void> {
    await this.userRepository.increment({ id: userId }, 'xp', amount);
  }
}
