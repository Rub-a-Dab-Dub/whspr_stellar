import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ContactImportService } from './contact-import.service';
import { ContactsRepository } from './contacts.repository';
import { ContactImportSession } from './entities/contact-import-session.entity';
import { ContactHashType, UserContactHashIndex } from './entities/user-contact-hash-index.entity';
import { Contact, ContactStatus } from './entities/contact.entity';

const OWNER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TARGET = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const THIRD = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

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

describe('ContactImportService', () => {
  let service: ContactImportService;
  let contactsRepo: jest.Mocked<ContactsRepository>;
  let sessionRepo: jest.Mocked<Repository<ContactImportSession>>;
  let userHashRepo: jest.Mocked<Repository<UserContactHashIndex>>;

  beforeEach(async () => {
    process.env.CONTACT_IMPORT_HMAC_SECRET = 'unit-test-secret';

    const contactsRepoMock: Partial<jest.Mocked<ContactsRepository>> = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      isBlockedEither: jest.fn(),
    };

    const sessionRepoMock: Partial<jest.Mocked<Repository<ContactImportSession>>> = {
      findOne: jest.fn(),
      create: jest.fn((v) => v as ContactImportSession),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const userHashRepoMock: Partial<jest.Mocked<Repository<UserContactHashIndex>>> = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactImportService,
        { provide: ContactsRepository, useValue: contactsRepoMock },
        { provide: getRepositoryToken(ContactImportSession), useValue: sessionRepoMock },
        { provide: getRepositoryToken(UserContactHashIndex), useValue: userHashRepoMock },
      ],
    }).compile();

    service = module.get(ContactImportService);
    contactsRepo = module.get(ContactsRepository);
    sessionRepo = module.get(getRepositoryToken(ContactImportSession));
    userHashRepo = module.get(getRepositoryToken(UserContactHashIndex));
  });

  it('hashContacts hashes normalized inputs and deduplicates', () => {
    const hashes = service.hashContacts([
      { phone: ' +1 (555) 777-8888 ', email: 'Alice@EXAMPLE.com ' },
      { phone: '+15557778888', email: 'alice@example.com' },
    ]);

    expect(hashes.phoneHashes).toHaveLength(1);
    expect(hashes.emailHashes).toHaveLength(1);
    expect(hashes.phoneHashes[0]).toHaveLength(64);
    expect(hashes.emailHashes[0]).toHaveLength(64);
    expect(hashes.phoneHashes[0]).not.toContain('5557778888');
    expect(hashes.emailHashes[0]).not.toContain('alice@example.com');
  });

  it('hashContacts rejects entries with no phone/email', () => {
    expect(() => service.hashContacts([{ phone: '   ' }])).toThrow(BadRequestException);
  });

  it('importContacts stores hashes and returns public matches', async () => {
    sessionRepo.findOne.mockResolvedValue(null);
    sessionRepo.save.mockResolvedValue({} as ContactImportSession);
    userHashRepo.find
      .mockResolvedValueOnce([
        {
          userId: TARGET,
          username: 'bob',
          displayName: 'Bob',
          avatarUrl: null,
          type: ContactHashType.PHONE,
          hash: 'x',
        } as UserContactHashIndex,
      ])
      .mockResolvedValueOnce([
        {
          userId: TARGET,
          username: 'bob',
          displayName: 'Bob',
          avatarUrl: null,
          type: ContactHashType.EMAIL,
          hash: 'y',
        } as UserContactHashIndex,
      ]);

    const result = await service.importContacts(OWNER, {
      contacts: [{ phone: '+15551234567', email: 'bob@example.com' }],
    });

    expect(result.importedCount).toBe(1);
    expect(result.matchedCount).toBe(1);
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        userId: TARGET,
        username: 'bob',
      }),
    );
    expect(sessionRepo.save).toHaveBeenCalled();
  });

  it('getMatches returns empty when no active session exists', async () => {
    sessionRepo.findOne.mockResolvedValue(null);
    await expect(service.getMatches(OWNER)).resolves.toEqual([]);
  });

  it('addMatchedAsContact creates accepted links for matches', async () => {
    jest.spyOn(service, 'getMatches').mockResolvedValue([
      { userId: TARGET, username: 'bob', displayName: 'Bob', avatarUrl: null },
      { userId: THIRD, username: 'cat', displayName: 'Cat', avatarUrl: null },
    ]);

    contactsRepo.isBlockedEither.mockResolvedValue(false);
    contactsRepo.findOne
      .mockResolvedValueOnce(null) // owner -> target
      .mockResolvedValueOnce(null) // target -> owner
      .mockResolvedValueOnce(makeContact({ ownerId: OWNER, contactId: THIRD })) // owner -> third
      .mockResolvedValueOnce(null); // third -> owner
    contactsRepo.create.mockResolvedValue(makeContact({ status: ContactStatus.ACCEPTED }));
    contactsRepo.save.mockResolvedValue(makeContact({ status: ContactStatus.ACCEPTED }));

    const result = await service.addMatchedAsContact(OWNER);

    expect(result.totalMatched).toBe(2);
    expect(result.addedCount).toBe(2);
    expect(contactsRepo.create).toHaveBeenCalled();
  });

  it('pruneExpiredSessions deletes old session rows', async () => {
    sessionRepo.delete.mockResolvedValue({ affected: 1, raw: {} });
    await service.pruneExpiredSessions();
    expect(sessionRepo.delete).toHaveBeenCalledTimes(1);
  });
});
