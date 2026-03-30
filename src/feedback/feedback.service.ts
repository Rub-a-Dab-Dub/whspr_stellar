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
import { CreateFeedbackResponseDto, ScreenshotPresign } from './dto/create-feedback-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UserTier } from '../users/entities/user.entity';
import { PresignAttachmentDto } from '../attachments/dto/presign-attachment.dto';
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

async submitFeedback(dto: CreateFeedbackDto, req: Request, userId?: string): Promise<CreateFeedbackResponseDto> {
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

    const entityData: Partial<FeedbackReport> = {
      userId,
      type: dto.type,
      title: dto.title,
      description: dto.description,
      appVersion,
      platform,
      deviceInfo,
      // Auto-priority: high for bugs
      priority: dto.type === FeedbackType.BUG ? FeedbackPriority.HIGH : FeedbackPriority.MEDIUM,
      status: FeedbackStatus.NEW,
    };

    const report = await this.repo.createAndSave(entityData);

    let screenshotPresign: ScreenshotPresign | undefined;
    if (dto.screenshot) {
      const tempId = `feedback-${report.id}`;
      const fakeUser: UserResponseDto = {
        id: `feedback-anon-${report.id}`,
        tier: UserTier.SILVER,
        walletAddress: 'GFEEDBACKANON',
        isActive: true,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const presignDto: PresignAttachmentDto = {
        messageId: tempId,
        fileName: 'screenshot.png',
        mimeType: 'image/png',
        fileSize: 5242880, // 5MB
      };
      const presignData = await this.attachmentsService.generateUploadUrl(fakeUser, presignDto);
      screenshotPresign = {
        uploadUrl: presignData.uploadUrl,
        fileKey: presignData.fileKey,
        fileUrl: presignData.fileUrl,
        expiresIn: presignData.expiresIn,
      };
      // Temp store presign data for confirm (use cache or separate table? For now cache w/ short TTL)
      await this.cacheManager.set(`feedback-presign-${report.id}`, screenshotPresign, presignData.expiresIn);
    }

    // High priority bug → notify admin
    if (report.priority === FeedbackPriority.HIGH && report.type === FeedbackType.BUG) {
      await this.emailService.sendBugReportEmail(
        'admin@whspr.stellar.com',
        report.title,
        report.description,
        report.appVersion,
        report.platform,
        report.id,
      ).catch(err => this.logger.error(`Admin email failed: ${err.message}`));
    }

    this.logger.log(`Feedback #${report.id} submitted (${dto.type})${dto.screenshot ? ' with screenshot presign' : ''}`);
    
    const response = this.toResponseDto(report) as CreateFeedbackResponseDto;
    if (screenshotPresign) {
      response.screenshotPresign = screenshotPresign;
    }
    return response;
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
