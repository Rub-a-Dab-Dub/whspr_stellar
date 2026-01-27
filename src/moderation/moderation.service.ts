import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockedUser } from '../entities/blocked-user.entity';
import { Report, ReportStatus } from '../entities/report.entity';
import { CreateReportDto, ReviewReportDto } from '../dto/moderation.dto';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(BlockedUser)
    private blockedUserRepository: Repository<BlockedUser>,
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
  ) {}

  // ============================================================================
  // BLOCKING LOGIC
  // ============================================================================

  async blockUser(
    blockerId: string,
    blockedUserId: string,
    reason?: string,
  ): Promise<BlockedUser> {
    if (blockerId === blockedUserId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const existing = await this.blockedUserRepository.findOne({
      where: { blockerId, blockedUserId },
    });

    if (existing) {
      throw new BadRequestException('User already blocked');
    }

    const block = this.blockedUserRepository.create({
      blockerId,
      blockedUserId,
      reason,
    });

    return this.blockedUserRepository.save(block);
  }

  async unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
    const result = await this.blockedUserRepository.delete({
      blockerId,
      blockedUserId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Block not found');
    }
  }

  async getBlockedUsers(userId: string): Promise<BlockedUser[]> {
    return this.blockedUserRepository.find({
      where: { blockerId: userId },
      order: { blockedAt: 'DESC' },
    });
  }

  async isBlocked(userId: string, targetUserId: string): Promise<boolean> {
    const count = await this.blockedUserRepository.count({
      where: [
        { blockerId: userId, blockedUserId: targetUserId },
        { blockerId: targetUserId, blockedUserId: userId },
      ],
    });
    return count > 0;
  }

  // ============================================================================
  // REPORTING LOGIC
  // ============================================================================

  async createReport(
    reporterId: string,
    reportedUserId: string,
    createDto: CreateReportDto,
  ): Promise<Report> {
    if (reporterId === reportedUserId) {
      throw new BadRequestException('Cannot report yourself');
    }

    const report = this.reportRepository.create({
      reporterId,
      reportedUserId,
      ...createDto,
    });

    const saved = await this.reportRepository.save(report);

    // Check for auto-actions
    await this.checkAutoActions(reportedUserId);

    return saved;
  }

  async getReports(status?: ReportStatus): Promise<Report[]> {
    const where = status ? { status } : {};
    return this.reportRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async reviewReport(
    reportId: string,
    reviewerId: string,
    reviewDto: ReviewReportDto,
  ): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.status = reviewDto.status;
    report.moderatorNotes = reviewDto.moderatorNotes;
    report.reviewedBy = reviewerId;
    report.reviewedAt = new Date();

    return this.reportRepository.save(report);
  }

  async appealReport(reportId: string, appealReason: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status !== ReportStatus.RESOLVED) {
      throw new BadRequestException('Can only appeal resolved reports');
    }

    report.status = ReportStatus.APPEALED;
    report.appealReason = appealReason;
    report.appealedAt = new Date();

    return this.reportRepository.save(report);
  }

  // ============================================================================
  // AUTO-ACTIONS
  // ============================================================================

  private async checkAutoActions(userId: string): Promise<void> {
    const recentReports = await this.reportRepository.count({
      where: {
        reportedUserId: userId,
        status: ReportStatus.PENDING,
      },
    });

    // Auto-action: If 5+ pending reports, mark for urgent review
    if (recentReports >= 5) {
      await this.reportRepository.update(
        { reportedUserId: userId, status: ReportStatus.PENDING },
        { status: ReportStatus.UNDER_REVIEW },
      );
    }
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  async getReportAnalytics(): Promise<any> {
    const [total, pending, underReview, resolved, dismissed] =
      await Promise.all([
        this.reportRepository.count(),
        this.reportRepository.count({
          where: { status: ReportStatus.PENDING },
        }),
        this.reportRepository.count({
          where: { status: ReportStatus.UNDER_REVIEW },
        }),
        this.reportRepository.count({
          where: { status: ReportStatus.RESOLVED },
        }),
        this.reportRepository.count({
          where: { status: ReportStatus.DISMISSED },
        }),
      ]);

    return {
      total,
      byStatus: {
        pending,
        underReview,
        resolved,
        dismissed,
      },
    };
  }

  async getUserReportCount(userId: string): Promise<number> {
    return this.reportRepository.count({
      where: { reportedUserId: userId },
    });
  }
}
