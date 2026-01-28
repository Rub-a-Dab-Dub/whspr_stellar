import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transfer, TransferStatus } from '../entities/transfer.entity';
import { BulkTransfer } from '../entities/bulk-transfer.entity';

export interface TransferAnalytics {
  totalTransfers: number;
  totalVolume: string;
  successRate: number;
  averageAmount: string;
  topRecipients: Array<{ recipientId: string; count: number; totalAmount: string }>;
  dailyVolume: Array<{ date: string; volume: string; count: number }>;
}

@Injectable()
export class TransferAnalyticsService {
  private readonly logger = new Logger(TransferAnalyticsService.name);

  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    @InjectRepository(BulkTransfer)
    private readonly bulkTransferRepository: Repository<BulkTransfer>,
  ) {}

  async getUserAnalytics(userId: string, days: number = 30): Promise<TransferAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transfers = await this.transferRepository
      .createQueryBuilder('transfer')
      .where('transfer.senderId = :userId', { userId })
      .andWhere('transfer.createdAt >= :startDate', { startDate })
      .getMany();

    const totalTransfers = transfers.length;
    const completedTransfers = transfers.filter(t => t.status === TransferStatus.COMPLETED);
    const totalVolume = completedTransfers.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const successRate = totalTransfers > 0 ? (completedTransfers.length / totalTransfers) * 100 : 0;
    const averageAmount = completedTransfers.length > 0 ? totalVolume / completedTransfers.length : 0;

    const recipientMap = new Map<string, { count: number; totalAmount: number }>();
    completedTransfers.forEach(transfer => {
      const existing = recipientMap.get(transfer.recipientId) || { count: 0, totalAmount: 0 };
      recipientMap.set(transfer.recipientId, {
        count: existing.count + 1,
        totalAmount: existing.totalAmount + parseFloat(transfer.amount),
      });
    });

    const topRecipients = Array.from(recipientMap.entries())
      .map(([recipientId, data]) => ({
        recipientId,
        count: data.count,
        totalAmount: data.totalAmount.toFixed(8),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const dailyVolumeMap = new Map<string, { volume: number; count: number }>();
    completedTransfers.forEach(transfer => {
      const date = transfer.createdAt.toISOString().split('T')[0];
      const existing = dailyVolumeMap.get(date) || { volume: 0, count: 0 };
      dailyVolumeMap.set(date, {
        volume: existing.volume + parseFloat(transfer.amount),
        count: existing.count + 1,
      });
    });

    const dailyVolume = Array.from(dailyVolumeMap.entries())
      .map(([date, data]) => ({
        date,
        volume: data.volume.toFixed(8),
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalTransfers,
      totalVolume: totalVolume.toFixed(8),
      successRate: parseFloat(successRate.toFixed(2)),
      averageAmount: averageAmount.toFixed(8),
      topRecipients,
      dailyVolume,
    };
  }

  async getGlobalAnalytics(days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.transferRepository
      .createQueryBuilder('transfer')
      .select('COUNT(*)', 'totalTransfers')
      .addSelect('SUM(CASE WHEN status = :completed THEN CAST(amount AS DECIMAL) ELSE 0 END)', 'totalVolume')
      .addSelect('COUNT(CASE WHEN status = :completed THEN 1 END)', 'completedTransfers')
      .where('transfer.createdAt >= :startDate', { startDate })
      .setParameter('completed', TransferStatus.COMPLETED)
      .getRawOne();

    return {
      totalTransfers: parseInt(result.totalTransfers) || 0,
      totalVolume: parseFloat(result.totalVolume || '0').toFixed(8),
      completedTransfers: parseInt(result.completedTransfers) || 0,
      successRate: result.totalTransfers > 0 
        ? ((result.completedTransfers / result.totalTransfers) * 100).toFixed(2)
        : '0.00',
    };
  }
}
