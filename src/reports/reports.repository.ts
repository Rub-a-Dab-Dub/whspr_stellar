import { Injectable } from '@nestjs/common';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import { Report, ReportStatus, ReportTargetType } from './entities/report.entity';

@Injectable()
export class ReportsRepository extends Repository<Report> {
  constructor(private readonly dataSource: DataSource) {
    super(Report, dataSource.createEntityManager());
  }

  countByTarget(targetId: string, targetType: ReportTargetType): Promise<number> {
    return this.count({
      where: {
        targetId,
        targetType,
      },
    });
  }

  findByTarget(targetId: string, targetType: ReportTargetType): Promise<Report[]> {
    return this.find({
      where: {
        targetId,
        targetType,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  getPendingReports(): Promise<Report[]> {
    return this.find({
      where: {
        status: In([ReportStatus.PENDING, ReportStatus.REVIEWED]),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async updateStatus(
    reportId: string,
    status: ReportStatus,
    reviewerId: string | null,
    reviewedAt: Date,
  ): Promise<void> {
    await this.update(
      { id: reportId },
      {
        status,
        reviewedBy: reviewerId,
        reviewedAt,
      },
    );
  }

  async updateStatusByTarget(
    targetId: string,
    targetType: ReportTargetType,
    currentStatuses: ReportStatus[],
    nextStatus: ReportStatus,
    reviewedAt: Date,
  ): Promise<number> {
    const result = await this.update(
      {
        targetId,
        targetType,
        status: In(currentStatuses),
      },
      {
        status: nextStatus,
        reviewedAt,
      },
    );

    return result.affected ?? 0;
  }

  async existsRecentDuplicate(
    reporterId: string,
    targetId: string,
    targetType: ReportTargetType,
    cutoff: Date,
  ): Promise<boolean> {
    const count = await this.createQueryBuilder('report')
      .where('report.reporterId = :reporterId', { reporterId })
      .andWhere('report.targetId = :targetId', { targetId })
      .andWhere('report.targetType = :targetType', { targetType })
      .andWhere(
        '(report.createdAt >= :cutoff OR (report.status = :dismissed AND report.reviewedAt >= :cutoff))',
        {
          cutoff,
          dismissed: ReportStatus.DISMISSED,
        },
      )
      .getCount();

    return count > 0;
  }

  findOneById(id: string): Promise<Report | null> {
    return this.findOne({ where: { id } });
  }

  findResolvedByTargetSince(
    targetId: string,
    targetType: ReportTargetType,
    cutoff: Date,
  ): Promise<Report[]> {
    return this.find({
      where: {
        targetId,
        targetType,
        status: In([ReportStatus.DISMISSED, ReportStatus.ACTIONED]),
        reviewedAt: MoreThanOrEqual(cutoff),
      },
    });
  }
}
