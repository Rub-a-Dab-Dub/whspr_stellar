import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DataExportRequest, ExportStatus } from './entities/data-export-request.entity';

@Injectable()
export class DataExportRequestRepository extends Repository<DataExportRequest> {
  constructor(private dataSource: DataSource) {
    super(DataExportRequest, dataSource.createEntityManager());
  }

  async findActiveExportByUserId(userId: string): Promise<DataExportRequest | null> {
    return this.findOne({
      where: [
        { userId, status: ExportStatus.PENDING },
        { userId, status: ExportStatus.PROCESSING },
      ],
    });
  }

  async findExportById(id: string): Promise<DataExportRequest | null> {
    return this.findOne({ where: { id } });
  }

  async findUserExports(userId: string): Promise<DataExportRequest[]> {
    return this.find({
      where: { userId },
      order: { requestedAt: 'DESC' },
      take: 10,
    });
  }

  async findExpiredExports(beforeDate: Date): Promise<DataExportRequest[]> {
    return this.createQueryBuilder('export')
      .where('export.status = :status', { status: ExportStatus.READY })
      .andWhere('export.expiresAt < :date', { date: beforeDate })
      .getMany();
  }

  async findPendingExports(): Promise<DataExportRequest[]> {
    return this.find({
      where: { status: ExportStatus.PENDING },
      order: { requestedAt: 'ASC' },
      take: 100,
    });
  }
}
