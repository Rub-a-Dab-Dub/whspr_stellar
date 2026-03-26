import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PreKeyBundle } from './entities/pre-key-bundle.entity';

@Injectable()
export class PreKeyBundlesRepository extends Repository<PreKeyBundle> {
  constructor(private dataSource: DataSource) {
    super(PreKeyBundle, dataSource.createEntityManager());
  }

  findValidByUserId(userId: string): Promise<PreKeyBundle | null> {
    return this.findOne({
      where: { userId, isValid: true },
      order: { createdAt: 'DESC' },
    });
  }

  findByEncryptionKeyId(encryptionKeyId: string): Promise<PreKeyBundle | null> {
    return this.findOne({ where: { encryptionKeyId, isValid: true } });
  }

  async invalidateByUserId(userId: string): Promise<void> {
    await this.update({ userId, isValid: true }, { isValid: false });
  }
}
