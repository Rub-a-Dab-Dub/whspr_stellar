import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackReport, FeedbackStatus, FeedbackPriority, FeedbackType } from './entities/feedback-report.entity';
import { GetFeedbackQueryDto } from './dto/get-feedback-query.dto';
import { FeedbackStatsDto } from './dto/feedback-stats.dto';

export interface PaginatedFeedback {
  items: FeedbackReport[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class FeedbackReportRepository {
  private readonly logger = new Logger(FeedbackReportRepository.name);

  constructor(
    @InjectRepository(FeedbackReport)
    private readonly repo: Repository<FeedbackReport>,
  ) {}

  async createAndSave(createData: Partial<FeedbackReport>): Promise<FeedbackReport> {
    const entity = this.repo.create(createData);
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<FeedbackReport | null> {
    return this.repo.findOne({ where: { id } });
  }

  async getFeedbackQueue(query: GetFeedbackQueryDto): Promise<PaginatedFeedback> {
    const qb = this.repo.createQueryBuilder('fb')
      .orderBy('fb.status', 'ASC')
      .addOrderBy('fb.priority', 'DESC')
      .addOrderBy('fb.createdAt', 'DESC');

    if (query.type) qb.andWhere('fb.type = :type', { type: query.type });
    if (query.status) qb.andWhere('fb.status = :status', { status: query.status });
    if (query.priority) qb.andWhere('fb.priority = :priority', { priority: query.priority });
    if (query.version) qb.andWhere('fb.appVersion = :version', { version: query.version });

    qb.skip((query.page! - 1) * query.limit!)
      .take(query.limit!);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: query.page!, limit: query.limit! };
  }

  async getStats(): Promise<FeedbackStatsDto> {
    const [byType, byStatus, byPriority, byVersion, total, highPriorityBugs] = await Promise.all([
      this.repo.createQueryBuilder('fb')
        .select('fb.type, COUNT(*)::integer', 'count')
        .groupBy('fb.type')
        .getRawMany(),
      this.repo.createQueryBuilder('fb')
        .select('fb.status, COUNT(*)::integer', 'count')
        .groupBy('fb.status')
        .getRawMany(),
      this.repo.createQueryBuilder('fb')
        .select('fb.priority, COUNT(*)::integer', 'count')
        .groupBy('fb.priority')
        .getRawMany(),
      this.repo.createQueryBuilder('fb')
        .select('fb.appVersion, COUNT(*)::integer', 'count')
        .where('fb.appVersion IS NOT NULL')
        .groupBy('fb.appVersion')
        .getRawMany(),
      this.repo.count(),
      this.repo.count({ where: { type: FeedbackType.BUG, priority: FeedbackPriority.HIGH } }),
    ]);

    return {
      byType: Object.fromEntries(byType.map(r => [r.type, parseInt(r.count)])),
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, parseInt(r.count)])),
      byPriority: Object.fromEntries(byPriority.map(r => [r.priority, parseInt(r.count)])),
      byVersion: Object.fromEntries(byVersion.map(r => [r.appVersion, parseInt(r.count)])),
      total,
      highPriorityBugs,
    };
  }

  async update(id: string, updates: Partial<FeedbackReport>): Promise<FeedbackReport> {
    await this.repo.update(id, updates);
    return this.findById(id)!;
  }
}
