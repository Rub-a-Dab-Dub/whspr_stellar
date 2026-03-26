import { Test, TestingModule } from '@nestjs/testing';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { DataExportResponseDto } from './dto/data-export.dto';
import { ConsentRecordResponseDto } from './dto/consent.dto';
import { DeleteAccountResponseDto } from './dto/account-deletion.dto';
import { ExportStatus } from './entities/data-export-request.entity';
import { ConsentType } from './entities/consent-record.entity';

describe('PrivacyController', () => {
  let controller: PrivacyController;
  let service: PrivacyService;

  const mockRequest = {
    user: { id: 'user-1' },
    ip: '192.168.1.1',
    connection: { remoteAddress: '192.168.1.1' },
  };

  const mockExportResponse: DataExportResponseDto = {
    id: 'export-1',
    userId: 'user-1',
    status: ExportStatus.PENDING,
    fileUrl: null,
    requestedAt: new Date(),
    completedAt: null,
    expiresAt: null,
    errorMessage: null,
  };

  const mockConsentResponse: ConsentRecordResponseDto = {
    id: 'consent-1',
    consentType: ConsentType.MARKETING,
    isGranted: true,
    grantedAt: new Date(),
    revokedAt: null,
  };

  const mockDeleteResponse: DeleteAccountResponseDto = {
    success: true,
    message: 'Account will be deleted in 30 days',
    scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancellationToken: 'cancel-token',
  };

  const mockServiceMethods = {
    requestDataExport: jest.fn(),
    getExportStatus: jest.fn(),
    downloadExport: jest.fn(),
    deleteAccount: jest.fn(),
    recordConsent: jest.fn(),
    revokeConsent: jest.fn(),
    getConsentHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrivacyController],
      providers: [
        {
          provide: PrivacyService,
          useValue: mockServiceMethods,
        },
      ],
    }).compile();

    controller = module.get<PrivacyController>(PrivacyController);
    service = module.get<PrivacyService>(PrivacyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestDataExport', () => {
    it('should request data export', async () => {
      mockServiceMethods.requestDataExport.mockResolvedValue(mockExportResponse);

      const result = await controller.requestDataExport(mockRequest, {});

      expect(result.status).toBe(ExportStatus.PENDING);
      expect(mockServiceMethods.requestDataExport).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getExportStatus', () => {
    it('should get export status', async () => {
      const statusResponse = {
        id: 'export-1',
        status: ExportStatus.PROCESSING,
        progress: 50,
        estimatedTime: 300,
        fileUrl: null,
        expiresAt: null,
        errorMessage: null,
      };
      mockServiceMethods.getExportStatus.mockResolvedValue(statusResponse);

      const result = await controller.getExportStatus(mockRequest, 'export-1');

      expect(result.progress).toBe(50);
      expect(mockServiceMethods.getExportStatus).toHaveBeenCalledWith('export-1', 'user-1');
    });
  });

  describe('downloadExport', () => {
    it('should return download URL', async () => {
      const downloadResponse = {
        url: 'https://cdn.example.com/export.zip',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      };
      mockServiceMethods.downloadExport.mockResolvedValue(downloadResponse);

      const result = await controller.downloadExport(mockRequest, 'export-1');

      expect(result.url).toContain('export.zip');
      expect(mockServiceMethods.downloadExport).toHaveBeenCalledWith('export-1', 'user-1');
    });
  });

  describe('deleteAccount', () => {
    it('should schedule account deletion', async () => {
      mockServiceMethods.deleteAccount.mockResolvedValue(mockDeleteResponse);

      const result = await controller.deleteAccount(mockRequest, { reason: 'Not using anymore' });

      expect(result.success).toBe(true);
      expect(result.cancellationToken).toBeDefined();
      expect(mockServiceMethods.deleteAccount).toHaveBeenCalledWith('user-1', {
        reason: 'Not using anymore',
      });
    });
  });

  describe('recordConsent', () => {
    it('should record consent', async () => {
      mockServiceMethods.recordConsent.mockResolvedValue(mockConsentResponse);

      const result = await controller.recordConsent(mockRequest, {
        consentType: ConsentType.MARKETING,
        isGranted: true,
      });

      expect(result.isGranted).toBe(true);
      expect(mockServiceMethods.recordConsent).toHaveBeenCalled();
    });
  });

  describe('getConsents', () => {
    it('should get all consents', async () => {
      const consentResponse = {
        marketing: { isGranted: true, grantedAt: new Date(), revokedAt: null },
        analytics: { isGranted: false, grantedAt: new Date(), revokedAt: new Date() },
      };
      mockServiceMethods.getConsentHistory.mockResolvedValue(consentResponse);

      const result = await controller.getConsents(mockRequest);

      expect(result).toBeDefined();
      expect(mockServiceMethods.getConsentHistory).toHaveBeenCalledWith('user-1', undefined);
    });

    it('should get consent for specific type', async () => {
      const historyResponse = {
        consentType: ConsentType.MARKETING,
        currentStatus: true,
        history: [mockConsentResponse],
      };
      mockServiceMethods.getConsentHistory.mockResolvedValue(historyResponse);

      const result = await controller.getConsents(mockRequest, 'marketing');

      expect(result.history).toBeDefined();
      expect(mockServiceMethods.getConsentHistory).toHaveBeenCalledWith('user-1', 'marketing');
    });
  });

  describe('revokeConsent', () => {
    it('should revoke consent', async () => {
      const revokedConsent = {
        ...mockConsentResponse,
        revokedAt: new Date(),
      };
      mockServiceMethods.revokeConsent.mockResolvedValue(revokedConsent);

      const result = await controller.revokeConsent(mockRequest, 'marketing');

      expect(result.revokedAt).toBeDefined();
      expect(mockServiceMethods.revokeConsent).toHaveBeenCalledWith('user-1', 'marketing');
    });
  });
});
