import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { PrivacyService } from './privacy.service';
import { DataExportRequestRepository } from './data-export-request.repository';
import { ConsentRecordsRepository } from './consent-records.repository';
import { UsersRepository } from '../users/users.repository';
import { DataExportRequest, ExportStatus } from './entities/data-export-request.entity';
import { ConsentRecord, ConsentType } from './entities/consent-record.entity';
import { User } from '../users/entities/user.entity';

describe('PrivacyService', () => {
  let service: PrivacyService;
  let exportRepository: DataExportRequestRepository;
  let consentRepository: ConsentRecordsRepository;
  let usersRepository: UsersRepository;
  let exportQueue: any;

  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    walletAddress: '0x123...',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    bio: null,
    preferredLocale: null,
    referralCode: null,
    tier: 'silver' as any,
    isActive: true,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExport: DataExportRequest = {
    id: 'export-1',
    userId: 'user-1',
    status: ExportStatus.PENDING,
    fileUrl: null,
    errorMessage: null,
    retryCount: 0,
    requestedAt: new Date(),
    completedAt: null,
    expiresAt: null,
    user: mockUser,
    updatedAt: new Date(),
  };

  const mockConsent: ConsentRecord = {
    id: 'consent-1',
    userId: 'user-1',
    consentType: ConsentType.MARKETING,
    isGranted: true,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    grantedAt: new Date(),
    revokedAt: null,
    user: mockUser,
  };

  const mockRepositories = {
    exportRepository: {
      findActiveExportByUserId: jest.fn(),
      findExportById: jest.fn(),
      findUserExports: jest.fn(),
      findExpiredExports: jest.fn(),
      findPendingExports: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    },
    consentRepository: {
      findCurrentConsent: jest.fn(),
      findConsentHistory: jest.fn(),
      findAllCurrentConsents: jest.fn(),
      findConsentsByType: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    },
    usersRepository: {
      findOne: jest.fn(),
      save: jest.fn(),
    },
    exportQueue: {
      add: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyService,
        { provide: DataExportRequestRepository, useValue: mockRepositories.exportRepository },
        { provide: ConsentRecordsRepository, useValue: mockRepositories.consentRepository },
        { provide: UsersRepository, useValue: mockRepositories.usersRepository },
        { provide: getQueueToken('data-export'), useValue: mockRepositories.exportQueue },
      ],
    }).compile();

    service = module.get<PrivacyService>(PrivacyService);
    exportRepository = module.get<DataExportRequestRepository>(DataExportRequestRepository);
    consentRepository = module.get<ConsentRecordsRepository>(ConsentRecordsRepository);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    exportQueue = module.get(getQueueToken('data-export'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestDataExport', () => {
    it('should create new export request', async () => {
      mockRepositories.exportRepository.findActiveExportByUserId.mockResolvedValue(null);
      mockRepositories.exportRepository.create.mockReturnValue(mockExport);
      mockRepositories.exportRepository.save.mockResolvedValue(mockExport);

      const result = await service.requestDataExport('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.status).toBe(ExportStatus.PENDING);
      expect(mockRepositories.exportQueue.add).toHaveBeenCalled();
    });

    it('should throw ConflictException if active export exists', async () => {
      mockRepositories.exportRepository.findActiveExportByUserId.mockResolvedValue(mockExport);

      await expect(service.requestDataExport('user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('getExportStatus', () => {
    it('should return export status', async () => {
      const readyExport = { ...mockExport, status: ExportStatus.READY, completedAt: new Date() };
      mockRepositories.exportRepository.findExportById.mockResolvedValue(readyExport);

      const result = await service.getExportStatus('export-1', 'user-1');

      expect(result.id).toBe('export-1');
      expect(result.progress).toBe(100);
    });

    it('should throw NotFoundException if export does not exist', async () => {
      mockRepositories.exportRepository.findExportById.mockResolvedValue(null);

      await expect(service.getExportStatus('unknown', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for unauthorized access', async () => {
      const otherUserExport = { ...mockExport, userId: 'user-2' };
      mockRepositories.exportRepository.findExportById.mockResolvedValue(otherUserExport);

      await expect(service.getExportStatus('export-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('downloadExport', () => {
    it('should return download URL for ready export', async () => {
      const readyExport = {
        ...mockExport,
        status: ExportStatus.READY,
        fileUrl: 'https://cdn.example.com/export.zip',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      };
      mockRepositories.exportRepository.findExportById.mockResolvedValue(readyExport);

      const result = await service.downloadExport('export-1', 'user-1');

      expect(result.url).toBe('https://cdn.example.com/export.zip');
      expect(result.expiresAt).toBeDefined();
    });

    it('should throw BadRequestException if export not ready', async () => {
      mockRepositories.exportRepository.findExportById.mockResolvedValue(mockExport);

      await expect(service.downloadExport('export-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if link expired', async () => {
      const expiredExport = {
        ...mockExport,
        status: ExportStatus.READY,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockRepositories.exportRepository.findExportById.mockResolvedValue(expiredExport);

      await expect(service.downloadExport('export-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordConsent', () => {
    it('should record new consent', async () => {
      mockRepositories.usersRepository.findOne.mockResolvedValue(mockUser);
      mockRepositories.consentRepository.create.mockReturnValue(mockConsent);
      mockRepositories.consentRepository.save.mockResolvedValue(mockConsent);

      const result = await service.recordConsent('user-1', {
        consentType: ConsentType.MARKETING,
        isGranted: true,
        userAgent: 'Mozilla/5.0',
      });

      expect(result.consentType).toBe(ConsentType.MARKETING);
      expect(result.isGranted).toBe(true);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepositories.usersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.recordConsent('unknown', {
          consentType: ConsentType.MARKETING,
          isGranted: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeConsent', () => {
    it('should revoke existing consent', async () => {
      mockRepositories.usersRepository.findOne.mockResolvedValue(mockUser);
      mockRepositories.consentRepository.findCurrentConsent.mockResolvedValue(mockConsent);
      mockRepositories.consentRepository.save.mockResolvedValue({
        ...mockConsent,
        revokedAt: new Date(),
      });

      const result = await service.revokeConsent('user-1', ConsentType.MARKETING);

      expect(result.revokedAt).toBeDefined();
    });

    it('should throw BadRequestException if no active consent', async () => {
      mockRepositories.usersRepository.findOne.mockResolvedValue(mockUser);
      mockRepositories.consentRepository.findCurrentConsent.mockResolvedValue(null);

      await expect(service.revokeConsent('user-1', ConsentType.MARKETING)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getConsentHistory', () => {
    it('should return all consents if no type specified', async () => {
      mockRepositories.usersRepository.findOne.mockResolvedValue(mockUser);
      mockRepositories.consentRepository.findAllCurrentConsents.mockResolvedValue([mockConsent]);

      const result = await service.getConsentHistory('user-1');

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should return consent history for specific type', async () => {
      mockRepositories.usersRepository.findOne.mockResolvedValue(mockUser);
      mockRepositories.consentRepository.findConsentHistory.mockResolvedValue([mockConsent]);

      const result = await service.getConsentHistory('user-1', ConsentType.MARKETING);

      expect(result).toBeDefined();
      expect('history' in result).toBe(true);
    });
  });

  describe('deleteAccount', () => {
    it('should schedule account deletion', async () => {
      mockRepositories.usersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.deleteAccount('user-1', {});

      expect(result.success).toBe(true);
      expect(result.scheduledFor).toBeDefined();
      expect(result.cancellationToken).toBeDefined();
      expect(mockRepositories.exportQueue.add).toHaveBeenCalledWith(
        'anonymize-account',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepositories.usersRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteAccount('unknown', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('processDataExport', () => {
    it('should process export and set status to READY', async () => {
      mockRepositories.exportRepository.findExportById.mockResolvedValue(mockExport);
      mockRepositories.exportRepository.save.mockResolvedValue(mockExport);

      await service.processDataExport('export-1', 'user-1');

      expect(mockRepositories.exportRepository.save).toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      mockRepositories.exportRepository.findExportById.mockResolvedValue(mockExport);
      mockRepositories.exportRepository.save.mockRejectedValueOnce(new Error('DB Error'));

      await service.processDataExport('export-1', 'user-1');

      // Should not throw, but log error
      expect(mockRepositories.exportRepository.save).toHaveBeenCalled();
    });
  });

  describe('anonymizeAccount', () => {
    it('should anonymize user data', async () => {
      mockRepositories.usersRepository.findOne.mockResolvedValue(mockUser);
      mockRepositories.consentRepository.find.mockResolvedValue([mockConsent]);
      mockRepositories.dataExportRepository.find.mockResolvedValue([mockExport]);
      mockRepositories.usersRepository.save.mockResolvedValue(mockUser);

      const result = await service.anonymizeAccount('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.fieldsAnonymized).toContain('email');
      expect(result.fieldsAnonymized).toContain('username');
    });
  });

  describe('cleanupExpiredExports', () => {
    it('should cleanup expired exports', async () => {
      mockRepositories.exportRepository.findExpiredExports.mockResolvedValue([mockExport]);
      mockRepositories.exportRepository.save.mockResolvedValue(mockExport);

      const result = await service.cleanupExpiredExports();

      expect(result).toBeGreaterThanOrEqual(0);
      expect(mockRepositories.exportRepository.save).toHaveBeenCalled();
    });
  });
});
