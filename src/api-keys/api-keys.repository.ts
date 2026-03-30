import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';

@Injectable()
export class ApiKeysRepository extends Repository<ApiKey> {
  constructor(private readonly dataSource: DataSource) {
    super(ApiKey, dataSource.createEntityManager());
  }

  findByUserId(userId: string): Promise<ApiKey[]> {
    return this.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  findOwnedKey(userId: string, id: string): Promise<ApiKey | null> {
    return this.findOne({ where: { userId, id } });
  }

  findActiveById(id: string): Promise<ApiKey | null> {
    return this.createQueryBuilder('apiKey')
      .where('apiKey.id = :id', { id })
      .andWhere('apiKey.revokedAt IS NULL')
      .andWhere('(apiKey.expiresAt IS NULL OR apiKey.expiresAt > NOW())')
      .getOne();
  }
}
