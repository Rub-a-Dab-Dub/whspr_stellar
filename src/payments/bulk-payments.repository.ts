import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere, Between } from 'typeorm';
import { BulkPayment } from './entities/bulk-payment.entity';
import { BulkPaymentRow } from './entities/bulk-payment-row.entity';
import { BulkPaymentDto } from './dto/bulk-payment.dto';
import { PaginatedBulkPaymentsDto } from './dto/bulk-payment.dto';
import { BulkPaymentRowsQueryDto } from './dto/bulk-payment-row-list.dto';
import { PaginatedBulkPaymentRowsDto } from './dto/paginated-bulk-payment-rows.dto';
import { User } from '../../users/entities/user.entity';
import { BulkPaymentStatus } from './enums/bulk-payment-status.enum';
import { BulkPaymentRowStatus } from './enums/bulk-payment-row-status.enum';

interface CreateBulkPaymentData {
  initiatedById: string;
  label: string;
  csvKey: string;
  totalRows: number;
  totalAmountUsdc: string;
}

@Injectable()
export class BulkPaymentsRepository {
  private readonly logger = new Logger(BulkPaymentsRepository.name);

  constructor(
    @InjectRepository(BulkPayment)
    private readonly bulkPaymentRepo: Repository<BulkPayment>,
    @InjectRepository(BulkPaymentRow)
    private readonly rowRepo: Repository<BulkPaymentRow>,
    private dataSource: DataSource,
  ) {}

  async createBulkPayment(data: CreateBulkPaymentData, rowsData: Partial<BulkPaymentRow>[]): Promise<BulkPayment> {
    const bulkPayment = this.bulkPaymentRepo.create({
      ...data,
      status: BulkPaymentStatus.PENDING,
    });
    const savedBulk = await this.bulkPaymentRepo.save(bulkPayment);

    const rows = rowsData.map((r, idx) => this.rowRepo.create({
      bulkPaymentId: savedBulk.id,
      rowNumber: idx + 1,
      ...r,
    }));
    await this.rowRepo.save(rows);

    return savedBulk;
  }

  async findUserBulkPayments(userId: string, page: number = 0, limit: number = 20): Promise<PaginatedBulkPaymentsDto> {
    const [items, total] = await this.bulkPaymentRepo.findAndCount({
      where: { initiatedById: userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: page * limit,
      relations: ['initiatedBy'],
    });

    const dtos = items.map(item => ({
      ...item,
      progress: item.totalRows > 0 ? item.successCount / item.totalRows : 0,
    } as BulkPaymentDto));

    return {
      data: dtos,
      total,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<BulkPayment | null> {
    return this.bulkPaymentRepo.findOne({
      where: { id },
      relations: ['initiatedBy', 'rows'],
    });
  }

  async updateStatus(id: string, status: BulkPaymentStatus, completedAt?: Date): Promise<void> {
    await this.bulkPaymentRepo.update(id, { status, completedAt });
  }

  async updateCounts(id: string, successCount: number, failureCount: number): Promise<void> {
    await this.bulkPaymentRepo.update(id, { 
      successCount, 
      failureCount,
    });
  }

  async getRowsByBulkId(
    bulkPaymentId: string, 
    query: BulkPaymentRowsQueryDto,
  ): Promise<PaginatedBulkPaymentRowsDto> {
    const where: FindOptionsWhere<BulkPaymentRow> = { bulkPaymentId };
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.rowRepo.findAndCount({
      where,
      order: { rowNumber: 'ASC' },
      take: query.limit,
      skip: query.page * query.limit,
    });

    return {
      data: items.map(r => ({
        id: r.id,
        rowNumber: r.rowNumber,
        toUsername: r.toUsername,
        amountUsdc: r.amountUsdc,
        note: r.note,
        status: r.status,
        failureReason: r.failureReason,
        txId: r.txId,
        processedAt: r.processedAt,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async exportRowsCsv(bulkPaymentId: string): Promise<string> {
    const rows = await this.rowRepo.find({
      where: { bulkPaymentId },
      order: { rowNumber: 'ASC' },
    });

    // Simple CSV header + data
    const header = 'username,amount_usdc,note,status,failure_reason,tx_id,processed_at\n';
    const csvRows = rows.map(r => 
      `"${r.toUsername}","${r.amountUsdc}","${r.note || ''}","${r.status}","${r.failureReason || ''}","${r.txId || ''}","${r.processedAt?.toISOString() || ''}"`
    ).join('\n');

    return header + csvRows;
  }

  async getPendingRowsForProcessing(bulkPaymentId: string): Promise<BulkPaymentRow[]> {
    return this.rowRepo.find({
      where: [
        { bulkPaymentId, status: BulkPaymentRowStatus.PENDING },
        { bulkPaymentId, status: BulkPaymentRowStatus.FAILED }, // retry? 
      ],
      order: { rowNumber: 'ASC' },
      take: 1, // sequential
    });
  }

  async updateRowStatus(
    rowId: string, 
    status: BulkPaymentRowStatus, 
    updates: Partial<BulkPaymentRow> = {},
  ): Promise<void> {
    await this.rowRepo.update(rowId, { 
      status,
      processedAt: status === BulkPaymentRowStatus.SUCCESS ? new Date() : undefined,
      ...updates,
    });
  }
}

