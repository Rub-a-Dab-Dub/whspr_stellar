import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserConsent } from './entities/user-consent.entity';

@Injectable()
export class UserConsentRepository {
  constructor(
    @InjectRepository(UserConsent)
    private readonly repo: Repository<UserConsent>,
  ) {}

  create(data: Partial<UserConsent>): UserConsent {
    return this.repo.create(data);
  }

  async save(consent: UserConsent): Promise<UserConsent> {
    return this.repo.save(consent);
  }

  async findByUserAndDocument(userId: string, documentId: string): Promise<UserConsent | null> {
    return this.repo.findOne({ where: { userId, documentId } });
  }

  async findAllByUser(userId: string): Promise<UserConsent[]> {
    return this.repo.find({
      where: { userId },
      relations: ['document'],
      order: { acceptedAt: 'DESC' },
    });
  }

  async upsert(consent: UserConsent): Promise<UserConsent> {
    // Consent records are immutable — only insert, never update
    const existing = await this.findByUserAndDocument(consent.userId, consent.documentId);
    if (existing) {
      return existing;
    }
    return this.repo.save(consent);
  }
}
