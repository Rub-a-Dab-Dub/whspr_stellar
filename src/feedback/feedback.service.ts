import {
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  CACHE_MANAGER,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { Cache } from 'cache-manager';
import { AttachmentsService } from '../attachments/attachments.service';
import { FeedbackReportRepository } from './feedback-report.repository';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { GetFeedbackQueryDto } from './dto/get-feedback-query.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import { FeedbackStatsDto } from './dto/feedback-stats.dto';
import {
  FeedbackType,
  FeedbackStatus,
  FeedbackPriority,
  FeedbackReport,
} from './entities/feedback-report.entity';
import { LegalEmailService } from '../legal/legal-email.service';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly statsCacheKey = 'feedback:stats';

  constructor(
    private readonly repo: FeedbackReportRepository,
    private readonly attachmentsService: AttachmentsService,
    private readonly emailService: LegalEmailService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async submitFeedback(dto: CreateFeedbackDto, req: Request, userId?: string): Promise<FeedbackResponseDto> {
    // Extract from headers
    const appVersion = (req.headers['x-app-version'] as string) ?? 'unknown';
    const platform = (req.headers['x-platform'] as string) ?? 'unknown';
    let deviceInfo: Record<string, any> | undefined;
    try {
      const deviceStr = req.headers['x-device-info'] as string;
      deviceInfo = deviceStr ? JSON.parse(deviceStr) : undefined;
    } catch {
      this.logger.warn('Invalid device-info header');
    }

    // Validate screenshot if provided
    if (dto.screenshotUrl) {
      // Minimal validation (full in attachments)
      if (!dto.screenshotUrl.startsWith('http') || dto.screenshotUrl.length > 2048) {
        throw new BadRequestException('Invalid screenshotUrl');
      }
    }

    const entityData: Partial<FeedbackReport> = {
      ...dto,
      userId,
      appVersion,
      platform,
      deviceInfo,
      // Auto-priority: high for bugs
      priority: dto.type === FeedbackType.BUG ? FeedbackPriority.HIGH : FeedbackPriority.MEDIUM,
    };

    const report = await this.repo.createAndSave(entityData);

    // High priority bug → notify admin
    if (report.priority === FeedbackPriority.HIGH && report.type === FeedbackType.BUG) {
      await this.emailService.sendBugReportEmail(
        'admin@whspr.stellar.com', // config?
        report.title,
        report.description,
        report.appVersion,
        report.platform,
        report.id,
      ).catch(err => this.logger.error(`Admin email failed: ${err.message}`));
    }

    this.logger.log(`Feedback #${report.id} submitted (${dto.type})`);
    return this.toResponseDto(report);
  }

  async getFeedbackQueue(query: GetFeedbackQueryDto): Promise<{ items: FeedbackResponseDto[]; total: number; page: number; limit: number }> {
    const result = await this.repo.getFeedbackQueue(query);
    return {
      items: result.items.map(item => this.toResponseDto(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getFeedbackStats(): Promise<FeedbackStatsDto> {
    try {
      const cached = await this.cacheManager.get<FeedbackStatsDto>(this.statsCacheKey);
      if (cached) return cached;
    } catch (err) {
      this.logger.warn('Stats cache read failed', err);
    }

    const stats = await this.repo.getStats();
    try {
      await this.cacheManager.set(this.statsCacheKey, stats, 300); // 5min
    } catch (err) {
      this.logger.warn('Stats cache set failed', err);
    }
    return stats;
  }

  async updateStatus(id: string, dto: UpdateFeedbackDto): Promise<FeedbackResponseDto> {
    const report = await this.repo.findById(id);
    if (!report) throw new NotFoundException('Feedback not found');

    const updates: Partial<FeedbackReport> = { ...dto };
    if (dto.status === FeedbackStatus.RESOLVED || dto.status === FeedbackStatus.CLOSED) {
      updates.updatedAt = new Date();
    }

    const updated = await this.repo.update(id, updates);
    // Invalidate stats cache
    await this.cacheManager.del(this.statsCacheKey).catch(() => {});
    return this.toResponseDto(updated);
  }

  async exportFeedback(query: GetFeedbackQueryDto): Promise<string> {
    const { items } = await this.getFeedbackQueue(query);
    // Simple CSV (use csv-stringify in prod)
    const csv = [
      ['ID', 'Type', 'Title', 'Status', 'Priority', 'AppVersion', 'CreatedAt'],
      ...items.map(i => [i.id, i.type, i.title, i.status, i.priority, i.appVersion, i.createdAt.toISOString()]),
    ].map(row => row.join(',')).join('\\n');
    return csv;
  }

  private toResponseDto(report: FeedbackReport): FeedbackResponseDto {
    return {
      id: report.id,
      userId: report.userId,
      type: report.type,
      title: report.title,
      description: report.description,
      screenshotUrl: report.screenshotUrl,
      appVersion: report.appVersion,
      platform: report.platform,
      deviceInfo: report.deviceInfo,
      status: report.status,
      priority: report.priority,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }
}
