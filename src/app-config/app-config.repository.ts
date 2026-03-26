import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from './entities/app-config.entity';

@Injectable()
export class AppConfigRepository {
  constructor(
    @InjectRepository(AppConfig)
    private readonly repo: Repository<AppConfig>,
  ) {}

  findAll(): Promise<AppConfig[]> {
    return this.repo.find();
  }

  findByKey(key: string): Promise<AppConfig | null> {
    return this.repo.findOne({ where: { key } });
  }

  async upsertRow(row: Omit<AppConfig, 'updatedAt'> & { updatedAt?: Date }): Promise<void> {
    await this.repo.upsert(
      {
        key: row.key,
        value: row.value,
        valueType: row.valueType,
        description: row.description,
        isPublic: row.isPublic,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt ?? new Date(),
      },
      ['key'],
    );
  }

  async deleteByKey(key: string): Promise<void> {
    await this.repo.delete({ key });
  }
}
