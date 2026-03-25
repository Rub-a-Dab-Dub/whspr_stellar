import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContactsRepository } from './contacts.repository';
import { Contact, ContactStatus } from './entities/contact.entity';
import { AddContactDto } from './dto/add-contact.dto';
import { ContactResponseDto, PaginatedContactsDto } from './dto/contact-response.dto';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactsRepo: ContactsRepository,
    private readonly blockchainService: BlockchainService,
  ) {}

  // ─── Core Operations ────────────────────────────────────────────────────────

  async addContact(ownerId: string, dto: AddContactDto): Promise<ContactResponseDto> {
    if (ownerId === dto.contactId) {
      throw new BadRequestException('Cannot add yourself as a contact');
    }

    // Prevent adding someone who has blocked you or whom you blocked
    const blocked = await this.contactsRepo.isBlockedEither(ownerId, dto.contactId);
    if (blocked) {
      throw new ForbiddenException('Cannot add contact due to block status');
    }

    const existing = await this.contactsRepo.findOne(ownerId, dto.contactId);
    if (existing) {
      throw new ConflictException('Contact request already exists');
    }

    const contact = await this.contactsRepo.create({
      ownerId,
      contactId: dto.contactId,
      status: ContactStatus.PENDING,
      label: dto.label ?? null,
    });

    return this.toDto(contact);
  }

  async acceptContact(requesterId: string, contactId: string): Promise<ContactResponseDto> {
    // The incoming request was sent by `contactId` to `requesterId`
    const contact = await this.contactsRepo.findOne(contactId, requesterId);
    if (!contact) {
      throw new NotFoundException('Contact request not found');
    }
    if (contact.status !== ContactStatus.PENDING) {
      throw new ConflictException('Contact request is not pending');
    }

    contact.status = ContactStatus.ACCEPTED;
    const saved = await this.contactsRepo.save(contact);

    // Create the reverse relationship so both parties see each other
    const reverse = await this.contactsRepo.findOne(requesterId, contactId);
    if (!reverse) {
      await this.contactsRepo.create({
        ownerId: requesterId,
        contactId,
        status: ContactStatus.ACCEPTED,
        label: null,
      });
    } else {
      reverse.status = ContactStatus.ACCEPTED;
      await this.contactsRepo.save(reverse);
    }

    return this.toDto(saved);
  }

  async removeContact(ownerId: string, contactId: string): Promise<void> {
    const contact = await this.contactsRepo.findOne(ownerId, contactId);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    await this.contactsRepo.remove(contact);

    // Remove reverse entry if it exists
    const reverse = await this.contactsRepo.findOne(contactId, ownerId);
    if (reverse) {
      await this.contactsRepo.remove(reverse);
    }
  }

  async blockUser(ownerId: string, targetId: string): Promise<ContactResponseDto> {
    if (ownerId === targetId) {
      throw new BadRequestException('Cannot block yourself');
    }

    let contact = await this.contactsRepo.findOne(ownerId, targetId);
    if (contact) {
      contact.status = ContactStatus.BLOCKED;
      contact = await this.contactsRepo.save(contact);
    } else {
      contact = await this.contactsRepo.create({
        ownerId,
        contactId: targetId,
        status: ContactStatus.BLOCKED,
        label: null,
      });
    }

    // Sync block to on-chain contract (fire-and-forget; cron will reconcile)
    this.blockchainService.syncBlock(ownerId, targetId, true).catch(() => {});

    return this.toDto(contact);
  }

  async unblockUser(ownerId: string, targetId: string): Promise<void> {
    const contact = await this.contactsRepo.findOne(ownerId, targetId);
    if (!contact || contact.status !== ContactStatus.BLOCKED) {
      throw new NotFoundException('Block not found');
    }

    await this.contactsRepo.remove(contact);

    // Sync unblock to on-chain contract
    this.blockchainService.syncBlock(ownerId, targetId, false).catch(() => {});
  }

  async getContacts(
    ownerId: string,
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<PaginatedContactsDto> {
    const [contacts, total] = await this.contactsRepo.findAccepted(ownerId, page, limit, search);
    return {
      data: contacts.map(this.toDto),
      total,
      page,
      limit,
    };
  }

  async getBlockedUsers(ownerId: string): Promise<ContactResponseDto[]> {
    const blocked = await this.contactsRepo.findBlocked(ownerId);
    return blocked.map(this.toDto);
  }

  async isBlocked(blockerId: string, targetId: string): Promise<boolean> {
    return this.contactsRepo.isBlocked(blockerId, targetId);
  }

  /**
   * Used by messaging/transfer guards to enforce block checks.
   * Throws ForbiddenException if either party has blocked the other.
   */
  async enforceNotBlocked(userA: string, userB: string): Promise<void> {
    const blocked = await this.contactsRepo.isBlockedEither(userA, userB);
    if (blocked) {
      throw new ForbiddenException('Messaging is not allowed due to block status');
    }
  }

  // ─── On-chain Sync ──────────────────────────────────────────────────────────

  /**
   * Runs every 30 seconds to reconcile local block status with on-chain state.
   */
  @Cron('*/30 * * * * *')
  async syncOnChainBlockStatus(): Promise<void> {
    try {
      const onChainBlocks = await this.blockchainService.fetchAllBlocks();
      for (const { blockerId, targetId, isBlocked } of onChainBlocks) {
        const existing = await this.contactsRepo.findOne(blockerId, targetId);
        if (isBlocked && (!existing || existing.status !== ContactStatus.BLOCKED)) {
          await this.blockUser(blockerId, targetId);
        } else if (!isBlocked && existing?.status === ContactStatus.BLOCKED) {
          await this.contactsRepo.remove(existing);
        }
      }
    } catch {
      // Log but don't crash — sync will retry in 30s
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private toDto(contact: Contact): ContactResponseDto {
    return new ContactResponseDto({
      id: contact.id,
      ownerId: contact.ownerId,
      contactId: contact.contactId,
      status: contact.status,
      label: contact.label,
      createdAt: contact.createdAt,
    });
  }
}
