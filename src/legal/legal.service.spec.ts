import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LegalDocumentType } from './entities/legal-document.entity';
import { LegalDocumentsRepository } from './legal-document.repository';
import { LegalEmailService } from './legal-email.service';
import { LegalService } from './legal.service';
import { UserConsentsRepository } from './user-consent.repository';
import { UsersService } from '../users/users.service';

const mockDoc = (overrides = {}) => ({
  id: 'doc-uuid',
  type: LegalDocumentType.TERMS,
  version: '1.0.0',
  effectiveDate: new Date(),
  content: 'Terms content',
  isActive: true,
  createdAt: new Date(),
  ...overrides,
});

const mockConsent = (overrides = {}) => ({
  id: 'consent-uuid',
  userId: 'user-uuid',
  documentId: 'doc-uuid',
  version: '1.0.0',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  acceptedAt: new Date(),
  ...overrides,
});

describe('LegalService', () => {
  let service: LegalService;
  let docRepo: jest.Mocked<LegalDocumentsRepository>;
  let consentRepo: jest.Mocked<UserConsentsRepository>;
  let emailService: jest.Mocked<LegalEmailService>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalService,
        {
          provide: LegalDocumentsRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findById: jest.fn(),
            findActive: jest.fn(),
            findAllActive: jest.fn(),
            findByTypeAndVersion: jest.fn(),
            deactivateCurrent: jest.fn(),
          },
        },
        {
          provide: UserConsentsRepository,
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
    docRepo = module.get(LegalDocumentsRepository);
    consentRepo = module.get(UserConsentsRepository);
    emailService = module.get(LegalEmailService);
    usersService = module.get(UsersService);
  });

  // ── createDraft ────────────────────────────────────────────────────────────

  describe('createDraft', () => {
    it('creates and returns a draft document', async () => {
      const draft = mockDoc({ isActive: false });
      docRepo.findByTypeAndVersion.mockResolvedValue(null);
      docRepo.create.mockReturnValue(draft as any);
      docRepo.save.mockResolvedValue(draft as any);

      const result = await service.createDraft(
        {
          type: LegalDocumentType.TERMS,
          version: '1.0.0',
          content: 'Terms content',
          effectiveDate: new Date().toISOString(),
        },
        'admin-uuid',
      );

      expect(result.isActive).toBe(false);
      expect(docRepo.save).toHaveBeenCalled();
    });

    it('throws ConflictException when version already exists', async () => {
      docRepo.findByTypeAndVersion.mockResolvedValue(mockDoc() as any);

      await expect(
        service.createDraft(
          {
            type: LegalDocumentType.TERMS,
            version: '1.0.0',
            content: 'x',
            effectiveDate: new Date().toISOString(),
          },
          'admin-uuid',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── publishDocument ────────────────────────────────────────────────────────

  describe('publishDocument', () => {
    it('publishes a draft and deactivates the previous active doc', async () => {
      const draft = mockDoc({ isActive: false });
      const published = mockDoc({ isActive: true });
      docRepo.findById.mockResolvedValue(draft as any);
      docRepo.deactivateCurrent.mockResolvedValue(undefined);
      docRepo.save.mockResolvedValue(published as any);

      const result = await service.publishDocument('doc-uuid', 'admin-uuid');

      expect(docRepo.deactivateCurrent).toHaveBeenCalledWith(LegalDocumentType.TERMS);
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException for unknown id', async () => {
      docRepo.findById.mockResolvedValue(null);
      await expect(service.publishDocument('bad-id', 'admin-uuid')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when document is already active', async () => {
      docRepo.findById.mockResolvedValue(mockDoc({ isActive: true }) as any);
      await expect(service.publishDocument('doc-uuid', 'admin-uuid')).rejects.toThrow(BadRequestException);
    });

    it('sends email notifications for Terms publish', async () => {
      const draft = mockDoc({ isActive: false, type: LegalDocumentType.TERMS });
      const published = mockDoc();
      docRepo.findById.mockResolvedValue(draft as any);
      docRepo.deactivateCurrent.mockResolvedValue(undefined);
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

    it('does not send email notifications for non-Terms publish', async () => {
      const draft = mockDoc({ isActive: false, type: LegalDocumentType.PRIVACY });
      docRepo.findById.mockResolvedValue(draft as any);
      docRepo.deactivateCurrent.mockResolvedValue(undefined);
      docRepo.save.mockResolvedValue({ ...draft, isActive: true } as any);

      await service.publishDocument('doc-uuid', 'admin-uuid');
      await new Promise((r) => setTimeout(r, 10));

      expect(emailService.notifyNewTermsPublished).not.toHaveBeenCalled();
    });
  });

  // ── getActiveDocument ──────────────────────────────────────────────────────

  describe('getActiveDocument', () => {
    it('returns the active document', async () => {
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      const result = await service.getActiveDocument(LegalDocumentType.TERMS);
      expect(result.id).toBe('doc-uuid');
    });

    it('throws NotFoundException when none active', async () => {
      docRepo.findActive.mockResolvedValue(null);
      await expect(service.getActiveDocument(LegalDocumentType.TERMS)).rejects.toThrow(NotFoundException);
    });
  });

  // ── recordConsent ──────────────────────────────────────────────────────────

  describe('recordConsent', () => {
    it('records and returns consent', async () => {
      const consent = mockConsent();
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      consentRepo.create.mockReturnValue(consent as any);
      consentRepo.upsert.mockResolvedValue(consent as any);

      const result = await service.recordConsent(
        'user-uuid',
        LegalDocumentType.TERMS,
        '127.0.0.1',
        'jest',
      );
      expect(result.userId).toBe('user-uuid');
      expect(consentRepo.upsert).toHaveBeenCalled();
    });

    it('throws NotFoundException for missing active document', async () => {
      docRepo.findActive.mockResolvedValue(null);
      await expect(
        service.recordConsent('user-uuid', LegalDocumentType.TERMS, null, null),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── hasAcceptedCurrent ──────────────────────────────────────────────────────

  describe('hasAcceptedCurrent', () => {
    it('returns true when no active ToS exists', async () => {
      docRepo.findActive.mockResolvedValue(null);
      expect(await service.hasAcceptedCurrent('user-uuid')).toBe(true);
    });

    it('returns true when user has accepted', async () => {
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      consentRepo.findByUserAndDocument.mockResolvedValue(mockConsent() as any);
      expect(await service.hasAcceptedCurrent('user-uuid')).toBe(true);
    });

    it('returns false when user has not accepted', async () => {
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      consentRepo.findByUserAndDocument.mockResolvedValue(null);
      expect(await service.hasAcceptedCurrent('user-uuid')).toBe(false);
    });
  });

  // ── requireConsent ─────────────────────────────────────────────────────────

  describe('requireConsent', () => {
    it('does not throw when user has accepted', async () => {
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      consentRepo.findByUserAndDocument.mockResolvedValue(mockConsent() as any);
      await expect(service.requireConsent('user-uuid')).resolves.not.toThrow();
    });

    it('throws ForbiddenException when user has not accepted', async () => {
      docRepo.findActive.mockResolvedValue(mockDoc() as any);
      consentRepo.findByUserAndDocument.mockResolvedValue(null);
      await expect(service.requireConsent('user-uuid')).rejects.toThrow(ForbiddenException);
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
