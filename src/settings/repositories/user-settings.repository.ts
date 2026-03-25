import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { UserSettings } from '../entities/user-settings.entity';

@Injectable()
export class UserSettingsRepository {
  constructor(
    @InjectRepository(UserSettings)
    private readonly repository: Repository<UserSettings>,
  ) {}

  async findByUserId(userId: string): Promise<UserSettings | null> {
    return this.repository.findOne({ where: { userId } });
  }

  async create(settings: Partial<UserSettings>): Promise<UserSettings> {
    const entity = this.repository.create(settings);
    return this.repository.save(entity);
  }

  async update(userId: string, settings: Partial<UserSettings>): Promise<UpdateResult> {
    return this.repository.update({ userId }, settings);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }

  async save(settings: UserSettings): Promise<UserSettings> {
    return this.repository.save(settings);
  }
}
