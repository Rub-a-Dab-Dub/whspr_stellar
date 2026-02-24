import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReportsService } from './services/reports.service';
import { ReportType, ReportFormat, ReportJobStatus } from './entities/report-job.entity';
import { Readable } from 'stream';

describe('AdminController - Reports', () => {
  let controller: AdminController;
  let reportsService: ReportsService;

  const mockReportsService = {
    generateReport: jest.fn(),
    getJobStatus: jest.fn(),
    downloadReport: jest.fn(),
  };

  const mockAdminService = {
    getUsers: jest.fn(),
    exportUsers: jest.fn(),
    getUserDetail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    reportsService = module.get<ReportsService>(ReportsService);
  });

  describe('POST /admin/reports/generate', () => {
    it('should generate a report and return job details', async () => {
      const dto = {
        type: ReportType.REVENUE,
        format: ReportFormat.CSV,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      };

      const expectedResult = {
        jobId: 'test-job-id',
        estimatedCompletionMs: 10000,
      };

      mockReportsService.generateReport.mockResolvedValue(expectedResult);

      const result = await controller.generateReport(dto, { userId: 'admin-id' });

      expect(result).toEqual(expectedResult);
      expect(reportsService.generateReport).toHaveBeenCalledWith(dto, 'admin-id');
    });
  });

  describe('GET /admin/reports/:jobId/status', () => {
    it('should return job status', async () => {
      const jobId = 'test-job-id';
      const expectedStatus = {
        jobId,
        status: ReportJobStatus.COMPLETE,
        type: ReportType.REVENUE,
        format: ReportFormat.CSV,
        createdAt: new Date(),
        completedAt: new Date(),
        errorMessage: null,
      };

      mockReportsService.getJobStatus.mockResolvedValue(expectedStatus);

      const result = await controller.getReportStatus(jobId);

      expect(result).toEqual(expectedStatus);
      expect(reportsService.getJobStatus).toHaveBeenCalledWith(jobId);
    });
  });

  describe('GET /admin/reports/:jobId/download', () => {
    it('should download completed report', async () => {
      const jobId = 'test-job-id';
      const mockStream = Readable.from(['test,data\n1,2']);
      const expectedResult = {
        stream: mockStream,
        filename: 'revenue-report-2024-01-01.csv',
        contentType: 'text/csv',
      };

      mockReportsService.downloadReport.mockResolvedValue(expectedResult);

      const mockRes = {
        set: jest.fn(),
      };

      const result = await controller.downloadReport(jobId, mockRes as any);

      expect(reportsService.downloadReport).toHaveBeenCalledWith(jobId);
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="revenue-report-2024-01-01.csv"',
      });
    });
  });
});
