import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LegalDocumentStatus, LegalDocumentType } from './entities/legal-document.entity';
import { LegalDocumentRepository } from './legal-document.repository';
import { LegalEmailService } from './legal-email.service';
import { LegalService } from './legal.service';
import { UserConsentRepository } from './user-consent.repository';
import { UsersService } from '../users/users.service';

const mockDoc = (overrides = {}) => ({
  id: 'doc-uuid',
  type: LegalDocumentType.TERMS_OF_SERVICE,
  version: '1.0.0',
  content: 'Terms content',
  title: 'ToS',
  summary: null,
  status: LegalDocumentStatus.ACTIVE,
  publishedAt: new Date(),
  publishedBy: 'admin-uuid',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockConsent = (overrides = {}) => ({
  id: 'consent-uuid',
  userId: 'user-uuid',
  documentId: 'doc-uuid',
  documentVersion: '1.0.0',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  acceptedAt: new Date(),
  ...overrides,
});

describe('LegalService', () => {
  let service: LegalService;
  let docRepo: jest.Mocked<LegalDocumentRepository>;
  let consentRepo: jest.Mocked<UserConsentRepository>;
  let emailService: jest.Mocked<LegalEmailService>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalService,
        {
          provide: LegalDocumentRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findById: jest.fn(),
            findActive: jest.fn(),
            findAllActive: jest.fn(),
            findByTypeAndVersion: jest.fn(),
            archiveActiveDocuments: jest.fn(),
          },
        },
        {
          provide: UserConsentRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findByUserAndDocument: jest.fn(),
            findAllByUser: jest.fn(),
            upsert: jest.fn(),
          },
        },
        {
          provide: LegalEmailService,
          useValue: { notifyNewTermsPublished: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: UsersService,
          useValue: { paginate: jest.fn().mockResolvedValue({ data: [], meta: {} }) },
        },
      ],
    }).compile();

    service = module.get(LegalService);
    docRepo = module.get(LegalDocumentRepository);
    consentRepo = module.get(UserConsentRepository);
    emailService = module.get(LegalEmailService);
    usersService = module.get(UsersService);
  });

  // ── createDraft ────────────────────────────────────────────────────────────

  describe('createDraft', () => {
    it('creates and returns a draft document', async () => {
      const draft = mockDoc({ status: LegalDocumentStatus.DRAFT, publishedAt: null });
      docRepo.findByTypeAndVersion.mockResolvedValue(null);
      docRepo.create.mockReturnValue(draft as any);
      docRepo.save.mockResolvedValue(draft as any);

      const result = await service.createDraft(
        { type: LegalDocumentType.TERMS_OF_SERVICE, version: '1.0.0', content: 'Terms content' },
        'admin-uuid',
      );

      expect(result.status).toBe(LegalDocumentStatus.DRAFT);
      expect(docRepo.save).toHaveBeenCalled();
    });

    it('throws ConflictException when version already exists', async () => {
      docRepo.findByTypeAndVersion.mockResolvedValue(mockDoc() as any);

      await expect(
        service.createDraft(
          { type: LegalDocumentType.TERMS_OF_SERVICE, version: '1.0.0', content: 'x' },
          'admin-uuid',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── publishDocument ────────────────────────────────────────────────────────

  describe('publishDocument', () => {
    it('publishes a draft and archives the previous active doc', async () => {
      const draft = mockDoc({ status: LegalDocumentStatus.DRAFT, publishedAt: null });
      const published = mockDoc({ status: LegalDocumentStatus.ACTIVE });
      docRepo.findById.mockResolvedValue(draft as any);
      docRepo.archiveActiveDocuments.mockResolvedValue(undefined);
      docRepo.save.mockResolvedValue(published as any);

      const result = await service.publishDocument('doc-uuid', 'admin-uuid');

      expect(docRepo.archiveActiveDocuments).toHaveBeenCalledWith(LegalDocumentType.TERMS_OF_SERVICE);
      expect(result.status).toBe(LegalDocumentStatus.ACTIVE);
    });

    it('throws NotFoundException for unknown id', async () => {
      docRepo.findById.mockResolvedValue(null);
      await expect(service.publishDocument('bad-id', 'admin-uuid')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when doc is not DRAFT', async () => {
      docRepo.findById.mockResolvedValue(mockDoc({ status: LegalDocumentStatus.ACTIVE }) as any);
      await expect(service.publishDocument('doc-uuid', 'admin-uuid')).rejects.toThrow(BadRequestException);
    });

    it('sends email notifications after publish', async () => {
      const draft = mockDoc({ status: LegalDocumentStatus.DRAFT });
      const published = mockDoc();
      docRepo.findById.mockResolvedValue(draft as any);
      docRepo.archiveActiveDocuments.mockResolvedValue(undefined);
      docRepo.save.mockResolvedValue(published as any);
      usersService.paginate.mockResolvedValue({
        data: [{ id: 'u1', email: 'user@example.com' } as any],
        meta: {} as any,
      });

      await service.publishDocument('doc-uuid', 'admin-uuid');
      // allow fire-and-forget to settle
      await new Promise((r) => setTimeout(r, 10));

      expect(emailService.notifyNewTermsPublished).toHaveBeenCalled();
    });
  });

  // ── getActiveDocument ──────────────────────────────────────────────────────

  describe('getActiveDocument', () => {
    it('returns the active document', async () => {
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      const result = await service.getActiveDocument(LegalDocumentType.TERMS_OF_SERVICE);
      expect(result.id).toBe('doc-uuid');
    });

    it('throws NotFoundException when none active', async () => {
      docRepo.findActive.mockResolvedValue(null);
      await expect(service.getActiveDocument(LegalDocumentType.TERMS_OF_SERVICE)).rejects.toThrow(NotFoundException);
    });
  });

  // ── recordConsent ──────────────────────────────────────────────────────────

  describe('recordConsent', () => {
    it('records and returns consent', async () => {
      const consent = mockConsent();
      docRepo.findById.mockResolvedValue(mockDoc() as any);
      consentRepo.create.mockReturnValue(consent as any);
      consentRepo.upsert.mockResolvedValue(consent as any);

      const result = await service.recordConsent('user-uuid', 'doc-uuid', '127.0.0.1', 'jest');
      expect(result.userId).toBe('user-uuid');
      expect(consentRepo.upsert).toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown document', async () => {
      docRepo.findById.mockResolvedValue(null);
      await expect(service.recordConsent('user-uuid', 'bad-id', null, null)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for non-active document', async () => {
      docRepo.findById.mockResolvedValue(mockDoc({ status: LegalDocumentStatus.DRAFT }) as any);
      await expect(service.recordConsent('user-uuid', 'doc-uuid', null, null)).rejects.toThrow(BadRequestException);
    });
  });

  // ── checkConsent ───────────────────────────────────────────────────────────

  describe('checkConsent', () => {
    it('returns hasAccepted true when consent exists', async () => {
      consentRepo.findByUserAndDocument.mockResolvedValue(mockConsent() as any);
      const result = await service.checkConsent('user-uuid', 'doc-uuid');
      expect(result.hasAccepted).toBe(true);
    });

    it('returns hasAccepted false when no consent', async () => {
      consentRepo.findByUserAndDocument.mockResolvedValue(null);
      const result = await service.checkConsent('user-uuid', 'doc-uuid');
      expect(result.hasAccepted).toBe(false);
    });
  });

  // ── hasAcceptedLatestTerms ─────────────────────────────────────────────────

  describe('hasAcceptedLatestTerms', () => {
    it('returns true when no active ToS exists', async () => {
      docRepo.findActive.mockResolvedValue(null);
      expect(await service.hasAcceptedLatestTerms('user-uuid')).toBe(true);
    });

    it('returns true when user has accepted', async () => {
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      consentRepo.findByUserAndDocument.mockResolvedValue(mockConsent() as any);
      expect(await service.hasAcceptedLatestTerms('user-uuid')).toBe(true);
    });

    it('returns false when user has not accepted', async () => {
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      consentRepo.findByUserAndDocument.mockResolvedValue(null);
      expect(await service.hasAcceptedLatestTerms('user-uuid')).toBe(false);
    });
  });

  // ── enforceConsent ─────────────────────────────────────────────────────────

  describe('enforceConsent', () => {
    it('does not throw when user has accepted', async () => {
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      consentRepo.findByUserAndDocument.mockResolvedValue(mockConsent() as any);
      await expect(service.enforceConsent('user-uuid')).resolves.not.toThrow();
    });

    it('throws ForbiddenException when user has not accepted', async () => {
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      consentRepo.findByUserAndDocument.mockResolvedValue(null);
      await expect(service.enforceConsent('user-uuid')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── getConsentHistory ──────────────────────────────────────────────────────

  describe('getConsentHistory', () => {
    it('returns mapped consent history', async () => {
      consentRepo.findAllByUser.mockResolvedValue([mockConsent() as any]);
      const result = await service.getConsentHistory('user-uuid');
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-uuid');
    });
  });
});
