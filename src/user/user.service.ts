import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
  }

  async findOrCreate(walletAddress: string): Promise<User> {
    const normalized = walletAddress.toLowerCase();
    let user = await this.userRepo.findOne({
      where: { walletAddress: normalized },
    });

    if (!user) {
      user = this.userRepo.create({ walletAddress: normalized });
      await this.userRepo.save(user);
    }

    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    user.role = role;
    return this.userRepo.save(user);
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    user.isActive = isActive;
    return this.userRepo.save(user);
  }
}
