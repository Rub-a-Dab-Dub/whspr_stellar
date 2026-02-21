import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReportJob, ReportJobStatus, ReportType, ReportFormat } from '../entities/report-job.entity';
import { GenerateReportDto } from '../dto/generate-report.dto';
import { Readable } from 'stream';
import * as fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportJob)
    private readonly reportJobRepository: Repository<ReportJob>,
    @InjectQueue('reports')
    private readonly reportsQueue: Queue,
  ) {}

  async generateReport(
    dto: GenerateReportDto,
    userId: string,
  ): Promise<{ jobId: string; estimatedCompletionMs: number }> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Validate dates
    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    if (endDate > new Date()) {
      throw new BadRequestException('endDate cannot be in the future');
    }

    // Create report job
    const reportJob = this.reportJobRepository.create({
      type: dto.type,
      format: dto.format,
      startDate,
      endDate,
      requestedBy: userId,
      status: ReportJobStatus.PENDING,
      isScheduled: false,
    });

    const savedJob = await this.reportJobRepository.save(reportJob);

    // Add to queue
    await this.reportsQueue.add('generate', {
      jobId: savedJob.id,
    });

    // Estimate completion time based on report type
    const estimatedCompletionMs = this.estimateCompletionTime(dto.type);

    return {
      jobId: savedJob.id,
      estimatedCompletionMs,
    };
  }

  async getJobStatus(jobId: string): Promise<{
    jobId: string;
    status: ReportJobStatus;
    type: ReportType;
    format: ReportFormat;
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
  }> {
    const job = await this.reportJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Report job ${jobId} not found`);
    }

    return {
      jobId: job.id,
      status: job.status,
      type: job.type,
      format: job.format,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
    };
  }

  async downloadReport(jobId: string): Promise<{ stream: Readable; filename: string; contentType: string }> {
    const job = await this.reportJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Report job ${jobId} not found`);
    }

    if (job.status !== ReportJobStatus.COMPLETE) {
      throw new BadRequestException(`Report is not ready. Current status: ${job.status}`);
    }

    if (!job.filePath) {
      throw new NotFoundException('Report file not found');
    }

    // Check if file exists
    try {
      await access(job.filePath, fs.constants.R_OK);
    } catch {
      throw new NotFoundException('Report file has been deleted or is not accessible');
    }

    // Check if expired
    if (job.expiresAt && job.expiresAt < new Date()) {
      throw new BadRequestException('Report has expired and is no longer available');
    }

    const fileContent = await readFile(job.filePath);
    const stream = Readable.from(fileContent);

    const filename = `${job.type}-report-${job.createdAt.toISOString().split('T')[0]}.${job.format}`;
    const contentType = job.format === ReportFormat.CSV ? 'text/csv' : 'application/json';

    return { stream, filename, contentType };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyRevenueReport() {
    console.log('Generating daily revenue report...');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const reportJob = this.reportJobRepository.create({
      type: ReportType.REVENUE,
      format: ReportFormat.CSV,
      startDate,
      endDate,
      requestedBy: 'system',
      status: ReportJobStatus.PENDING,
      isScheduled: true,
    });

    const savedJob = await this.reportJobRepository.save(reportJob);

    await this.reportsQueue.add('generate', {
      jobId: savedJob.id,
    });

    console.log(`Daily revenue report job created: ${savedJob.id}`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredReports() {
    const expiredJobs = await this.reportJobRepository.find({
      where: {
        expiresAt: LessThan(new Date()),
        status: ReportJobStatus.COMPLETE,
      },
    });

    for (const job of expiredJobs) {
      if (job.filePath) {
        try {
          await unlink(job.filePath);
          console.log(`Deleted expired report file: ${job.filePath}`);
        } catch (error) {
          console.error(`Failed to delete report file: ${job.filePath}`, error);
        }
      }

      // Optionally delete the job record or mark as expired
      await this.reportJobRepository.remove(job);
    }

    if (expiredJobs.length > 0) {
      console.log(`Cleaned up ${expiredJobs.length} expired reports`);
    }
  }

  private estimateCompletionTime(type: ReportType): number {
    // Estimate in milliseconds
    switch (type) {
      case ReportType.USERS:
        return 5000; // 5 seconds
      case ReportType.REVENUE:
        return 10000; // 10 seconds
      case ReportType.TRANSACTIONS:
        return 15000; // 15 seconds
      case ReportType.ROOMS:
        return 8000; // 8 seconds
      default:
        return 10000;
    }
  }
}
