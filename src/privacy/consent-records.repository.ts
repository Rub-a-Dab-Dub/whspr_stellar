import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ConsentRecord, ConsentType } from './entities/consent-record.entity';

@Injectable()
export class ConsentRecordsRepository extends Repository<ConsentRecord> {
  constructor(private dataSource: DataSource) {
    super(ConsentRecord, dataSource.createEntityManager());
  }

  async findCurrentConsent(userId: string, consentType: ConsentType): Promise<ConsentRecord | null> {
    return this.createQueryBuilder('consent')
      .where('consent.userId = :userId', { userId })
      .andWhere('consent.consentType = :consentType', { consentType })
      .orderBy('consent.grantedAt', 'DESC')
      .limit(1)
      .getOne();
  }

  async findConsentHistory(userId: string, consentType?: ConsentType): Promise<ConsentRecord[]> {
    const query = this.createQueryBuilder('consent').where('consent.userId = :userId', { userId });

    if (consentType) {
      query.andWhere('consent.consentType = :consentType', { consentType });
    }

    return query.orderBy('consent.grantedAt', 'DESC').getMany();
  }

  async findAllCurrentConsents(userId: string): Promise<ConsentRecord[]> {
    // Get the latest consent for each type where revokedAt is null
    return this.createQueryBuilder('consent')
      .where('consent.userId = :userId', { userId })
      .andWhere('consent.revokedAt IS NULL')
      .groupBy('consent.consentType')
      .addGroupBy('consent.id')
      .orderBy('consent.grantedAt', 'DESC')
      .getMany();
  }

  async findConsentsByType(consentType: ConsentType, isGranted: boolean): Promise<ConsentRecord[]> {
    return this.find({
      where: { consentType, isGranted, revokedAt: null },
      order: { grantedAt: 'DESC' },
    });
  }
}
