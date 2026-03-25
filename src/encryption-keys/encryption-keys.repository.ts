import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EncryptionKey } from './entities/encryption-key.entity';

@Injectable()
export class EncryptionKeysRepository extends Repository<EncryptionKey> {
  constructor(private dataSource: DataSource) {
    super(EncryptionKey, dataSource.createEntityManager());
  }

  findActiveByUserId(userId: string): Promise<EncryptionKey | null> {
    return this.findOne({ where: { userId, isActive: true } });
  }

  findByUserId(userId: string): Promise<EncryptionKey[]> {
    return this.find({
      where: { userId },
      order: { version: 'DESC', createdAt: 'DESC' },
    });
  }

  findByUserAndId(userId: string, id: string): Promise<EncryptionKey | null> {
    return this.findOne({ where: { userId, id } });
  }

  async findNextVersion(userId: string): Promise<number> {
    const result = await this.createQueryBuilder('ek')
      .select('COALESCE(MAX(ek.version), 0)', 'maxVersion')
      .where('ek.userId = :userId', { userId })
      .getRawOne<{ maxVersion: number }>();
    return (result?.maxVersion ?? 0) + 1;
  }

  findPendingChainSync(): Promise<EncryptionKey[]> {
    return this.find({ where: { registeredOnChain: false, isActive: true } });
  }

  /** Atomically deactivates the current active key and activates the new one. */
  async rotateKeys(userId: string, newKeyId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(EncryptionKey, { userId, isActive: true }, { isActive: false });
      await manager.update(EncryptionKey, { id: newKeyId }, { isActive: true });
    });
  }
}
