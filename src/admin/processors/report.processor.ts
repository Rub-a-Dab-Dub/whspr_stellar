import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ReportJob, ReportJobStatus, ReportType, ReportFormat } from '../entities/report-job.entity';
import { User } from '../../user/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

interface ReportJobData {
  jobId: string;
}

@Processor('reports')
@Injectable()
export class ReportProcessor {
  private readonly logger = new Logger(ReportProcessor.name);
  private readonly reportsDir = path.join(process.cwd(), 'temp-reports');

  constructor(
    @InjectRepository(ReportJob)
    private readonly reportJobRepository: Repository<ReportJob>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.ensureReportsDirectory();
  }

  private async ensureReportsDirectory() {
    try {
      await mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create reports directory', error);
    }
  }

  @Process('generate')
  async handleReportGeneration(job: Job<ReportJobData>) {
    const { jobId } = job.data;
    this.logger.log(`Processing report job: ${jobId}`);

    const reportJob = await this.reportJobRepository.findOne({
      where: { id: jobId },
    });

    if (!reportJob) {
      this.logger.error(`Report job ${jobId} not found`);
      return;
    }

    try {
      // Update status to processing
      reportJob.status = ReportJobStatus.PROCESSING;
      await this.reportJobRepository.save(reportJob);

      // Generate report based on type
      const data = await this.generateReportData(reportJob);

      // Save report to file
      const filePath = await this.saveReportToFile(reportJob, data);

      // Update job as complete
      reportJob.status = ReportJobStatus.COMPLETE;
      reportJob.filePath = filePath;
      reportJob.completedAt = new Date();
      reportJob.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await this.reportJobRepository.save(reportJob);

      this.logger.log(`Report job ${jobId} completed successfully`);
    } catch (error) {
      this.logger.error(`Report job ${jobId} failed`, error);
      reportJob.status = ReportJobStatus.FAILED;
      reportJob.errorMessage = error.message;
      await this.reportJobRepository.save(reportJob);
    }
  }

  private async generateReportData(reportJob: ReportJob): Promise<any[]> {
    const { type, startDate, endDate } = reportJob;

    switch (type) {
      case ReportType.USERS:
        return await this.generateUsersReport(startDate, endDate);
      case ReportType.REVENUE:
        return await this.generateRevenueReport(startDate, endDate);
      case ReportType.TRANSACTIONS:
        return await this.generateTransactionsReport(startDate, endDate);
      case ReportType.ROOMS:
        return await this.generateRoomsReport(startDate, endDate);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }

  private async generateUsersReport(startDate: Date, endDate: Date): Promise<any[]> {
    const users = await this.userRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      relations: ['roles'],
      order: { createdAt: 'DESC' },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      isVerified: user.isVerified,
      isBanned: user.isBanned,
      roles: user.roles?.map((r) => r.name).join(';') || '',
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString(),
    }));
  }

  private async generateRevenueReport(startDate: Date, endDate: Date): Promise<any[]> {
    // Placeholder - implement based on your revenue/transaction schema
    this.logger.warn('Revenue report generation not fully implemented');
    return [
      {
        date: startDate.toISOString().split('T')[0],
        totalRevenue: 0,
        transactionCount: 0,
        averageTransaction: 0,
      },
    ];
  }

  private async generateTransactionsReport(startDate: Date, endDate: Date): Promise<any[]> {
    // Placeholder - implement based on your transaction schema
    this.logger.warn('Transactions report generation not fully implemented');
    return [
      {
        id: 'placeholder',
        amount: 0,
        type: 'tip',
        status: 'completed',
        createdAt: startDate.toISOString(),
      },
    ];
  }

  private async generateRoomsReport(startDate: Date, endDate: Date): Promise<any[]> {
    // Placeholder - implement based on your rooms schema
    this.logger.warn('Rooms report generation not fully implemented');
    return [
      {
        id: 'placeholder',
        name: 'Sample Room',
        memberCount: 0,
        messageCount: 0,
        createdAt: startDate.toISOString(),
      },
    ];
  }

  private async saveReportToFile(reportJob: ReportJob, data: any[]): Promise<string> {
    const timestamp = Date.now();
    const filename = `${reportJob.type}-${timestamp}.${reportJob.format}`;
    const filePath = path.join(this.reportsDir, filename);

    let content: string;

    if (reportJob.format === ReportFormat.CSV) {
      content = this.convertToCSV(data);
    } else {
      content = JSON.stringify(data, null, 2);
    }

    await writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header]?.toString() || '';
        return this.escapeCsvField(value);
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}
