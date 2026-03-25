import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsRepository } from './contacts.repository';
import { BlockchainService } from '../blockchain/blockchain.service';
import { Contact, ContactStatus } from './entities/contact.entity';

const OWNER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TARGET = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const THIRD  = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return Object.assign(new Contact(), {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    ownerId: OWNER,
    contactId: TARGET,
    status: ContactStatus.PENDING,
    label: null,
    createdAt: new Date(),
    ...overrides,
  });
}

describe('ContactsService', () => {
  let service: ContactsService;
  let repo: jest.Mocked<ContactsRepository>;
  let blockchain: jest.Mocked<BlockchainService>;

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<ContactsRepository>> = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findAccepted: jest.fn(),
      findBlocked: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      isBlocked: jest.fn(),
      isBlockedEither: jest.fn(),
    };

    const blockchainMock: Partial<jest.Mocked<BlockchainService>> = {
      syncBlock: jest.fn().mockResolvedValue(undefined),
      fetchAllBlocks: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: ContactsRepository, useValue: repoMock },
        { provide: BlockchainService, useValue: blockchainMock },
      ],
    }).compile();

    service = module.get(ContactsService);
    repo = module.get(ContactsRepository);
    blockchain = module.get(BlockchainService);
  });

  // ── addContact ──────────────────────────────────────────────────────────────

  describe('addContact', () => {
    it('throws BadRequest when adding self', async () => {
      await expect(service.addContact(OWNER, { contactId: OWNER }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws Forbidden when either party is blocked', async () => {
      repo.isBlockedEither.mockResolvedValue(true);
      await expect(service.addContact(OWNER, { contactId: TARGET }))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws Conflict when request already exists', async () => {
      repo.isBlockedEither.mockResolvedValue(false);
      repo.findOne.mockResolvedValue(makeContact());
      await expect(service.addContact(OWNER, { contactId: TARGET }))
        .rejects.toThrow(ConflictException);
    });

    it('creates a PENDING contact', async () => {
      repo.isBlockedEither.mockResolvedValue(false);
      repo.findOne.mockResolvedValue(null);
      const contact = makeContact();
      repo.create.mockResolvedValue(contact);

      const result = await service.addContact(OWNER, { contactId: TARGET, label: 'Alice' });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: OWNER,
        contactId: TARGET,
        status: ContactStatus.PENDING,
      }));
      expect(result.status).toBe(ContactStatus.PENDING);
    });
  });

  // ── acceptContact ───────────────────────────────────────────────────────────

  describe('acceptContact', () => {
    it('throws NotFound when request does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.acceptContact(OWNER, TARGET)).rejects.toThrow(NotFoundException);
    });

    it('throws Conflict when request is not PENDING', async () => {
      repo.findOne.mockResolvedValue(makeContact({ status: ContactStatus.ACCEPTED }));
      await expect(service.acceptContact(OWNER, TARGET)).rejects.toThrow(ConflictException);
    });

    it('sets status to ACCEPTED and creates reverse entry', async () => {
      const pending = makeContact({ ownerId: TARGET, contactId: OWNER, status: ContactStatus.PENDING });
      repo.findOne
        .mockResolvedValueOnce(pending)   // original request
        .mockResolvedValueOnce(null);     // reverse lookup
      repo.save.mockResolvedValue({ ...pending, status: ContactStatus.ACCEPTED } as Contact);
      repo.create.mockResolvedValue(makeContact({ ownerId: OWNER, contactId: TARGET, status: ContactStatus.ACCEPTED }));

      const result = await service.acceptContact(OWNER, TARGET);

      expect(repo.save).toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: OWNER,
        contactId: TARGET,
        status: ContactStatus.ACCEPTED,
      }));
      expect(result.status).toBe(ContactStatus.ACCEPTED);
    });
  });

  // ── removeContact ───────────────────────────────────────────────────────────

  describe('removeContact', () => {
    it('throws NotFound when contact does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.removeContact(OWNER, TARGET)).rejects.toThrow(NotFoundException);
    });

    it('removes contact and reverse entry', async () => {
      const contact = makeContact();
      const reverse = makeContact({ ownerId: TARGET, contactId: OWNER });
      repo.findOne
        .mockResolvedValueOnce(contact)
        .mockResolvedValueOnce(reverse);

      await service.removeContact(OWNER, TARGET);

      expect(repo.remove).toHaveBeenCalledTimes(2);
    });
  });

  // ── blockUser ───────────────────────────────────────────────────────────────

  describe('blockUser', () => {
    it('throws BadRequest when blocking self', async () => {
      await expect(service.blockUser(OWNER, OWNER)).rejects.toThrow(BadRequestException);
    });

    it('updates existing contact to BLOCKED', async () => {
      const contact = makeContact({ status: ContactStatus.ACCEPTED });
      repo.findOne.mockResolvedValue(contact);
      repo.save.mockResolvedValue({ ...contact, status: ContactStatus.BLOCKED } as Contact);

      const result = await service.blockUser(OWNER, TARGET);

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ContactStatus.BLOCKED }));
      expect(result.status).toBe(ContactStatus.BLOCKED);
    });

    it('creates new BLOCKED entry when no prior contact', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeContact({ status: ContactStatus.BLOCKED }));

      const result = await service.blockUser(OWNER, TARGET);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ status: ContactStatus.BLOCKED }));
      expect(result.status).toBe(ContactStatus.BLOCKED);
    });

    it('fires blockchain sync', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeContact({ status: ContactStatus.BLOCKED }));

      await service.blockUser(OWNER, TARGET);

      // give the fire-and-forget a tick
      await new Promise(r => setImmediate(r));
      expect(blockchain.syncBlock).toHaveBeenCalledWith(OWNER, TARGET, true);
    });
  });

  // ── unblockUser ─────────────────────────────────────────────────────────────

  describe('unblockUser', () => {
    it('throws NotFound when block does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.unblockUser(OWNER, TARGET)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when entry is not BLOCKED', async () => {
      repo.findOne.mockResolvedValue(makeContact({ status: ContactStatus.ACCEPTED }));
      await expect(service.unblockUser(OWNER, TARGET)).rejects.toThrow(NotFoundException);
    });

    it('removes block and syncs on-chain', async () => {
      repo.findOne.mockResolvedValue(makeContact({ status: ContactStatus.BLOCKED }));

      await service.unblockUser(OWNER, TARGET);

      expect(repo.remove).toHaveBeenCalled();
      await new Promise(r => setImmediate(r));
      expect(blockchain.syncBlock).toHaveBeenCalledWith(OWNER, TARGET, false);
    });
  });

  // ── getContacts ─────────────────────────────────────────────────────────────

  describe('getContacts', () => {
    it('returns paginated accepted contacts', async () => {
      const contacts = [makeContact({ status: ContactStatus.ACCEPTED })];
      repo.findAccepted.mockResolvedValue([contacts, 1]);

      const result = await service.getContacts(OWNER, 1, 20, 'alice');

      expect(repo.findAccepted).toHaveBeenCalledWith(OWNER, 1, 20, 'alice');
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  // ── getBlockedUsers ─────────────────────────────────────────────────────────

  describe('getBlockedUsers', () => {
    it('returns list of blocked contacts', async () => {
      repo.findBlocked.mockResolvedValue([makeContact({ status: ContactStatus.BLOCKED })]);
      const result = await service.getBlockedUsers(OWNER);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ContactStatus.BLOCKED);
    });
  });

  // ── isBlocked ───────────────────────────────────────────────────────────────

  describe('isBlocked', () => {
    it('delegates to repository', async () => {
      repo.isBlocked.mockResolvedValue(true);
      expect(await service.isBlocked(OWNER, TARGET)).toBe(true);
    });
  });

  // ── enforceNotBlocked ───────────────────────────────────────────────────────

  describe('enforceNotBlocked', () => {
    it('throws Forbidden when blocked', async () => {
      repo.isBlockedEither.mockResolvedValue(true);
      await expect(service.enforceNotBlocked(OWNER, TARGET)).rejects.toThrow(ForbiddenException);
    });

    it('resolves when not blocked', async () => {
      repo.isBlockedEither.mockResolvedValue(false);
      await expect(service.enforceNotBlocked(OWNER, TARGET)).resolves.toBeUndefined();
    });
  });

  // ── syncOnChainBlockStatus ──────────────────────────────────────────────────

  describe('syncOnChainBlockStatus', () => {
    it('blocks user when on-chain says blocked and local is not', async () => {
      blockchain.fetchAllBlocks.mockResolvedValue([{ blockerId: OWNER, targetId: TARGET, isBlocked: true }]);
      repo.findOne.mockResolvedValue(null);
      repo.isBlockedEither.mockResolvedValue(false);
      repo.create.mockResolvedValue(makeContact({ status: ContactStatus.BLOCKED }));

      await service.syncOnChainBlockStatus();

      expect(repo.create).toHaveBeenCalled();
    });

    it('removes block when on-chain says unblocked and local is blocked', async () => {
      blockchain.fetchAllBlocks.mockResolvedValue([{ blockerId: OWNER, targetId: TARGET, isBlocked: false }]);
      const blocked = makeContact({ status: ContactStatus.BLOCKED });
      repo.findOne.mockResolvedValue(blocked);

      await service.syncOnChainBlockStatus();

      expect(repo.remove).toHaveBeenCalledWith(blocked);
    });

    it('does not throw when blockchain call fails', async () => {
      blockchain.fetchAllBlocks.mockRejectedValue(new Error('network error'));
      await expect(service.syncOnChainBlockStatus()).resolves.toBeUndefined();
    });
  });
});
