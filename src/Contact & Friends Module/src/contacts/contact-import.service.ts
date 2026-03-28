import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, MoreThan, In, LessThan } from 'typeorm';
import { createHmac } from 'crypto';
import { ContactsRepository } from './contacts.repository';
import { ContactStatus } from './entities/contact.entity';
import { ImportContactsDto } from './dto/import-contacts.dto';
import {
  AddAllMatchedContactsResponseDto,
  ImportContactsResponseDto,
  MatchedUserDto,
} from './dto/contact-import-response.dto';
import { ContactImportHashes, ContactImportSession } from './entities/contact-import-session.entity';
import { ContactHashType, UserContactHashIndex } from './entities/user-contact-hash-index.entity';

const CONTACT_IMPORT_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ContactImportService {
  constructor(
    private readonly contactsRepo: ContactsRepository,
    @InjectRepository(ContactImportSession)
    private readonly sessionRepo: Repository<ContactImportSession>,
    @InjectRepository(UserContactHashIndex)
    private readonly userHashIndexRepo: Repository<UserContactHashIndex>,
  ) {}

  async importContacts(ownerId: string, dto: ImportContactsDto): Promise<ImportContactsResponseDto> {
    if (dto.contacts.length > 500) {
      throw new BadRequestException('A maximum of 500 contacts can be imported at once');
    }

    const hashes = this.hashContacts(dto.contacts);
    const matches = await this.matchContacts(ownerId, hashes);

    const now = new Date();
    const existing = await this.sessionRepo.findOne({ where: { ownerId } });
    if (existing) {
      existing.hashes = hashes;
      existing.expiresAt = new Date(now.getTime() + CONTACT_IMPORT_TTL_MS);
      await this.sessionRepo.save(existing);
    } else {
      await this.sessionRepo.save(
        this.sessionRepo.create({
          ownerId,
          hashes,
          expiresAt: new Date(now.getTime() + CONTACT_IMPORT_TTL_MS),
        }),
      );
    }

    return {
      importedCount: dto.contacts.length,
      matchedCount: matches.length,
      matches,
    };
  }

  hashContacts(contacts: Array<{ phone?: string; email?: string }>): ContactImportHashes {
    const phoneHashes = new Set<string>();
    const emailHashes = new Set<string>();

    for (const contact of contacts) {
      const normalizedPhone = this.normalizePhone(contact.phone);
      const normalizedEmail = this.normalizeEmail(contact.email);

      if (!normalizedPhone && !normalizedEmail) {
        throw new BadRequestException('Each contact must include phone or email');
      }

      if (normalizedPhone) {
        phoneHashes.add(this.hmacHash(`phone:${normalizedPhone}`));
      }
      if (normalizedEmail) {
        emailHashes.add(this.hmacHash(`email:${normalizedEmail}`));
      }
    }

    return {
      phoneHashes: [...phoneHashes],
      emailHashes: [...emailHashes],
    };
  }

  async matchContacts(ownerId: string, hashes: ContactImportHashes): Promise<MatchedUserDto[]> {
    const resultsByUserId = new Map<string, MatchedUserDto>();

    if (hashes.phoneHashes.length > 0) {
      const phoneMatches = await this.userHashIndexRepo.find({
        where: {
          hash: In(hashes.phoneHashes),
          type: ContactHashType.PHONE,
        },
      });
      this.collectMatches(ownerId, phoneMatches, resultsByUserId);
    }

    if (hashes.emailHashes.length > 0) {
      const emailMatches = await this.userHashIndexRepo.find({
        where: {
          hash: In(hashes.emailHashes),
          type: ContactHashType.EMAIL,
        },
      });
      this.collectMatches(ownerId, emailMatches, resultsByUserId);
    }

    return [...resultsByUserId.values()];
  }

  async getMatches(ownerId: string): Promise<MatchedUserDto[]> {
    const session = await this.sessionRepo.findOne({
      where: {
        ownerId,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!session) {
      return [];
    }

    return this.matchContacts(ownerId, session.hashes);
  }

  async addMatchedAsContact(ownerId: string): Promise<AddAllMatchedContactsResponseDto> {
    const matches = await this.getMatches(ownerId);
    let addedCount = 0;

    for (const match of matches) {
      if (match.userId === ownerId) continue;
      const blocked = await this.contactsRepo.isBlockedEither(ownerId, match.userId);
      if (blocked) continue;

      const ownerSide = await this.contactsRepo.findOne(ownerId, match.userId);
      if (!ownerSide) {
        await this.contactsRepo.create({
          ownerId,
          contactId: match.userId,
          status: ContactStatus.ACCEPTED,
          label: null,
        });
        addedCount += 1;
      } else if (ownerSide.status !== ContactStatus.ACCEPTED) {
        ownerSide.status = ContactStatus.ACCEPTED;
        await this.contactsRepo.save(ownerSide);
        addedCount += 1;
      }

      const reverseSide = await this.contactsRepo.findOne(match.userId, ownerId);
      if (!reverseSide) {
        await this.contactsRepo.create({
          ownerId: match.userId,
          contactId: ownerId,
          status: ContactStatus.ACCEPTED,
          label: null,
        });
      } else if (reverseSide.status !== ContactStatus.ACCEPTED) {
        reverseSide.status = ContactStatus.ACCEPTED;
        await this.contactsRepo.save(reverseSide);
      }
    }

    return {
      totalMatched: matches.length,
      addedCount,
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async pruneExpiredSessions(): Promise<void> {
    await this.sessionRepo.delete({ expiresAt: LessThan(new Date()) });
  }

  private collectMatches(
    ownerId: string,
    records: UserContactHashIndex[],
    resultsByUserId: Map<string, MatchedUserDto>,
  ): void {
    for (const record of records) {
      if (record.userId === ownerId || resultsByUserId.has(record.userId)) {
        continue;
      }
      resultsByUserId.set(record.userId, {
        userId: record.userId,
        username: record.username,
        displayName: record.displayName,
        avatarUrl: record.avatarUrl,
      });
    }
  }

  private hmacHash(value: string): string {
    const secret = process.env.CONTACT_IMPORT_HMAC_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret';
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private normalizePhone(phone?: string): string | null {
    if (!phone) return null;
    const normalized = phone.trim().replace(/[^0-9+]/g, '');
    if (!normalized) return null;
    return normalized;
  }

  private normalizeEmail(email?: string): string | null {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    return normalized;
  }
}
