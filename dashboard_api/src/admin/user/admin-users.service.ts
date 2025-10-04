// src/admin/users/admin-users.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { ethers } from 'ethers';
import { AuditLog } from 'src/audit-log/entities/audit-log.entity';
import { Pseudonym } from 'src/pseudonym/entities/pseudonym.entity';
import { User } from 'src/user/entities/user.entity';
import { BulkCreateUsersDto } from './dto/bulk-create-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Wallet } from 'src/wallet/entities/wallet.entity';

export interface BulkCreateError {
  user: string;
  error: string;
}

@Injectable()
export class AdminUsersService {
  private provider: ethers.JsonRpcProvider;

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Pseudonym)
    private pseudonymRepo: Repository<Pseudonym>,
    @InjectRepository(Wallet)
    private walletRepo: Repository<Wallet>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {
    // Initialize blockchain provider (e.g., Ethereum mainnet or testnet)
    this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
  }

  async create(createUserDto: CreateUserDto, adminId: string): Promise<User> {
    const { username, email, password, bio, pseudonyms, walletAddress } = createUserDto;

    // Check for existing user
    const existing = await this.userRepo.findOne({
      where: [{ username }, { email }],
    });
    if (existing) {
      throw new BadRequestException('Username or email already exists');
    }

    // Validate wallet address
    if (walletAddress && !ethers.isAddress(walletAddress)) {
      throw new BadRequestException('Invalid Ethereum wallet address');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.userRepo.create({
      username,
      email,
      passwordHash,
      bio,
      lastActivityAt: new Date(),
    });

    const savedUser = await this.userRepo.save(user);

    // Create pseudonyms
    if (pseudonyms && pseudonyms.length > 0) {
      const pseudonymEntities = pseudonyms.map((name) =>
        this.pseudonymRepo.create({ name, user: savedUser }),
      );
      await this.pseudonymRepo.save(pseudonymEntities);
    }

    // Create wallet
    if (walletAddress) {
      const balance = await this.getWalletBalance(walletAddress);
      const wallet = this.walletRepo.create({
        address: walletAddress,
        balance,
        user: savedUser,
        lastSyncedAt: new Date(),
      });
      await this.walletRepo.save(wallet);
    }

    // Create audit log
    await this.createAuditLog(savedUser.id, 'USER_CREATED', { username, email }, adminId);

    return this.findOne(savedUser.id);
  }

  async bulkCreate(
    bulkDto: BulkCreateUsersDto,
    adminId: string,
  ): Promise<{ success: number; failed: number; errors: BulkCreateError[] }> {
    const results = { success: 0, failed: 0, errors: [] as BulkCreateError[] };

    for (const userDto of bulkDto.users) {
      try {
        await this.create(userDto, adminId);
        results.success++;
      } catch (error: unknown) {
        results.failed++;
        results.errors.push({
          user: userDto.username,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  async findAll(query: QueryUsersDto) {
    const cacheKey = `users:list:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const { page = 1, limit = 10, search, sortBy, sortOrder, ...filters } = query;
    const skip = (page - 1) * limit;

    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.pseudonyms', 'pseudonyms')
      .leftJoinAndSelect('user.wallet', 'wallet')
      .where('user.isDeleted = :isDeleted', { isDeleted: false });

    // Search across multiple fields
    if (search) {
      qb.andWhere('(user.username LIKE :search OR user.email LIKE :search)', {
        search: `%${search}%`,
      });
    }

    // Apply filters
    if (filters.username) {
      qb.andWhere('user.username LIKE :username', { username: `%${filters.username}%` });
    }
    if (filters.email) {
      qb.andWhere('user.email LIKE :email', { email: `%${filters.email}%` });
    }
    if (filters.level !== undefined) {
      qb.andWhere('user.level = :level', { level: filters.level });
    }
    if (filters.minXp !== undefined) {
      qb.andWhere('user.xp >= :minXp', { minXp: filters.minXp });
    }
    if (filters.maxXp !== undefined) {
      qb.andWhere('user.xp <= :maxXp', { maxXp: filters.maxXp });
    }
    if (filters.lastActivityAfter) {
      qb.andWhere('user.lastActivityAt >= :lastActivityAfter', {
        lastActivityAfter: filters.lastActivityAfter,
      });
    }
    if (filters.walletAddress) {
      qb.andWhere('wallet.address = :walletAddress', {
        walletAddress: filters.walletAddress,
      });
    }
    if (filters.isVerified !== undefined) {
      qb.andWhere('user.isVerified = :isVerified', { isVerified: filters.isVerified });
    }
    if (filters.isSuspended !== undefined) {
      qb.andWhere('user.isSuspended = :isSuspended', { isSuspended: filters.isSuspended });
    }

    // Sorting
    qb.orderBy(`user.${sortBy}`, sortOrder);

    const [users, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const result = {
      data: users,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };

    await this.cacheManager.set(cacheKey, result, 300000); // Cache for 5 minutes
    return result;
  }

  async findOne(id: string): Promise<User> {
    const cacheKey = `user:${id}`;
    const cached = await this.cacheManager.get<User>(cacheKey);
    if (cached) return cached;

    const user = await this.userRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['pseudonyms', 'wallet'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Sync wallet balance if exists
    if (user.wallet) {
      const balance = await this.getWalletBalance(user.wallet.address);
      user.wallet.balance = balance;
      user.wallet.lastSyncedAt = new Date();
      await this.walletRepo.save(user.wallet);
    }

    await this.cacheManager.set(cacheKey, user, 300000);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, adminId: string): Promise<User> {
    const user = await this.findOne(id);
    const changes: Record<string, any> = {};

    Object.keys(updateUserDto).forEach((key) => {
      const k = key as keyof UpdateUserDto;
      if (updateUserDto[k] !== undefined && user[k as keyof User] !== updateUserDto[k]) {
        changes[k] = { from: user[k as keyof User], to: updateUserDto[k] };
        if (k in user) {
          (user as Record<keyof UpdateUserDto, any>)[k] = updateUserDto[k];
        }
      }
    });

    if (Object.keys(changes).length === 0) {
      return user;
    }

    await this.userRepo.save(user);
    await this.createAuditLog(user.id, 'USER_UPDATED', changes, adminId);
    await this.cacheManager.del(`user:${id}`);

    return this.findOne(id);
  }

  async softDelete(id: string, adminId: string): Promise<void> {
    const user = await this.findOne(id);
    user.isDeleted = true;
    user.deletedAt = new Date();
    await this.userRepo.save(user);
    await this.createAuditLog(user.id, 'USER_SOFT_DELETED', {}, adminId);
    await this.cacheManager.del(`user:${id}`);
  }

  async hardDelete(id: string, adminId: string): Promise<void> {
    const user = await this.findOne(id);
    await this.createAuditLog(user.id, 'USER_HARD_DELETED', { username: user.username }, adminId);
    await this.userRepo.remove(user);
    await this.cacheManager.del(`user:${id}`);
  }

  async getAuditLogs(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [logs, total] = await this.auditLogRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: logs,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  private async getWalletBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error(`Failed to fetch balance for ${address}:`, error);
      return '0';
    }
  }

  private async createAuditLog(
    userId: string,
    action: string,
    changes: Record<string, any>,
    performedBy: string,
  ): Promise<void> {
    const log = this.auditLogRepo.create({
      userId,
      action,
      changes,
      performedBy,
    });
    await this.auditLogRepo.save(log);
  }
}
