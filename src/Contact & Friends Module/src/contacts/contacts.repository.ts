import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Contact, ContactStatus } from './entities/contact.entity';

export interface FindContactsOptions {
  page?: number;
  limit?: number;
  search?: string; // search by username — joined externally or passed as contactIds
}

@Injectable()
export class ContactsRepository {
  constructor(
    @InjectRepository(Contact)
    private readonly repo: Repository<Contact>,
  ) {}

  async create(data: Partial<Contact>): Promise<Contact> {
    const contact = this.repo.create(data);
    return this.repo.save(contact);
  }

  async findOne(ownerId: string, contactId: string): Promise<Contact | null> {
    return this.repo.findOne({ where: { ownerId, contactId } });
  }

  async findById(id: string): Promise<Contact | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findAccepted(
    ownerId: string,
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<[Contact[], number]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.ownerId = :ownerId', { ownerId })
      .andWhere('c.status = :status', { status: ContactStatus.ACCEPTED });

    if (search) {
      // label-based search; username search requires a join with users table
      qb.andWhere('c.label ILIKE :search', { search: `%${search}%` });
    }

    qb.skip((page - 1) * limit).take(limit).orderBy('c.createdAt', 'DESC');

    return qb.getManyAndCount();
  }

  async findBlocked(ownerId: string): Promise<Contact[]> {
    return this.repo.find({
      where: { ownerId, status: ContactStatus.BLOCKED },
      order: { createdAt: 'DESC' },
    });
  }

  async save(contact: Contact): Promise<Contact> {
    return this.repo.save(contact);
  }

  async remove(contact: Contact): Promise<void> {
    await this.repo.remove(contact);
  }

  /**
   * Check if `blockerId` has blocked `targetId` (unilateral check).
   */
  async isBlocked(blockerId: string, targetId: string): Promise<boolean> {
    const count = await this.repo.count({
      where: { ownerId: blockerId, contactId: targetId, status: ContactStatus.BLOCKED },
    });
    return count > 0;
  }

  /**
   * Either party blocking the other counts as blocked for messaging purposes.
   */
  async isBlockedEither(userA: string, userB: string): Promise<boolean> {
    const count = await this.repo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: ContactStatus.BLOCKED })
      .andWhere(
        '(c.ownerId = :a AND c.contactId = :b) OR (c.ownerId = :b AND c.contactId = :a)',
        { a: userA, b: userB },
      )
      .getCount();
    return count > 0;
  }
}
