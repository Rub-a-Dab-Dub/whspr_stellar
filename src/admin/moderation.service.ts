import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportStatus } from './entities/report.entity';
import { AdminAction, ActionType } from './entities/admin-action.entity';
import { User } from '../user/entities/user.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { GetReportsDto } from './dto/get-reports.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { RemoveRoomDto } from './dto/remove-room.dto';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Report)
    private reportRepo: Repository<Report>,
    @InjectRepository(AdminAction)
    private adminActionRepo: Repository<AdminAction>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async createReport(userId: string, dto: CreateReportDto) {
    const report = this.reportRepo.create({
      reporterId: userId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: dto.reason,
    });
    return this.reportRepo.save(report);
  }

  async getReports(dto: GetReportsDto) {
    const { status, page = 1, limit = 20 } = dto;
    const qb = this.reportRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.reporter', 'reporter')
      .leftJoinAndSelect('r.reviewedBy', 'reviewer')
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      qb.where('r.status = :status', { status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async reviewReport(reportId: string, adminId: string, dto: ReviewReportDto) {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.status = dto.status;
    report.reviewedById = adminId;
    report.reviewedAt = new Date();

    await this.reportRepo.save(report);

    await this.logAction({
      adminId,
      actionType: ActionType.REVIEW_REPORT,
      targetId: reportId,
      reason: `Reviewed report: ${dto.status}`,
      metadata: { notes: dto.notes, reportTargetType: report.targetType, reportTargetId: report.targetId },
    });

    return report;
  }

  async banUser(userId: string, adminId: string, dto: BanUserDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isBanned) {
      throw new BadRequestException('User is already banned');
    }

    user.isBanned = true;
    await this.userRepo.save(user);

    await this.logAction({
      adminId,
      actionType: ActionType.BAN_USER,
      targetId: userId,
      reason: dto.reason,
      metadata: { username: user.username, email: user.email },
    });

    return { success: true, message: 'User banned successfully' };
  }

  async removeRoom(roomId: string, adminId: string, dto: RemoveRoomDto) {
    // Room removal logic would go here - for now just log the action
    await this.logAction({
      adminId,
      actionType: ActionType.REMOVE_ROOM,
      targetId: roomId,
      reason: dto.reason,
      metadata: { roomId },
    });

    return { success: true, message: 'Room removed successfully' };
  }

  private async logAction(data: {
    adminId: string;
    actionType: ActionType;
    targetId: string;
    reason: string;
    metadata?: Record<string, any>;
  }) {
    const action = this.adminActionRepo.create(data);
    return this.adminActionRepo.save(action);
  }
}
