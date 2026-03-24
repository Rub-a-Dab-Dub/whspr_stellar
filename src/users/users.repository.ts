import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class UsersRepository extends Repository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.findOne({
      where: { username },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async findActiveUsers(pagination: PaginationDto): Promise<[User[], number]> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    return this.findAndCount({
      where: { isActive: true },
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const query = this.createQueryBuilder('user').where('user.username = :username', {
      username,
    });

    if (excludeUserId) {
      query.andWhere('user.id != :excludeUserId', { excludeUserId });
    }

    const count = await query.getCount();
    return count === 0;
  }

  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    const query = this.createQueryBuilder('user').where('LOWER(user.email) = LOWER(:email)', {
      email,
    });

    if (excludeUserId) {
      query.andWhere('user.id != :excludeUserId', { excludeUserId });
    }

    const count = await query.getCount();
    return count === 0;
  }

  async isWalletAddressAvailable(
    walletAddress: string,
    excludeUserId?: string,
  ): Promise<boolean> {
    const query = this.createQueryBuilder('user').where(
      'LOWER(user.walletAddress) = LOWER(:walletAddress)',
      { walletAddress },
    );

    if (excludeUserId) {
      query.andWhere('user.id != :excludeUserId', { excludeUserId });
    }

    const count = await query.getCount();
    return count === 0;
  }
}
