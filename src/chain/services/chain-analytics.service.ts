import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RoomPayment,
  PaymentStatus,
} from '../../room/entities/room-payment.entity';
import { SupportedChain } from '../enums/supported-chain.enum';

export interface ChainPaymentStats {
  chain: string;
  totalPayments: number;
  totalVolume: string;
  totalFees: string;
  completedPayments: number;
  failedPayments: number;
}

@Injectable()
export class ChainAnalyticsService {
  private readonly logger = new Logger(ChainAnalyticsService.name);

  constructor(
    @InjectRepository(RoomPayment)
    private paymentRepository: Repository<RoomPayment>,
  ) {}

  /**
   * Get payment statistics aggregated by chain.
   */
  async getPaymentStatsByChain(): Promise<ChainPaymentStats[]> {
    const stats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.blockchain_network', 'chain')
      .addSelect('COUNT(*)', 'totalPayments')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'totalVolume')
      .addSelect('COALESCE(SUM(payment.platform_fee), 0)', 'totalFees')
      .addSelect(
        `COUNT(*) FILTER (WHERE payment.status = '${PaymentStatus.COMPLETED}')`,
        'completedPayments',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE payment.status = '${PaymentStatus.FAILED}')`,
        'failedPayments',
      )
      .groupBy('payment.blockchain_network')
      .getRawMany();

    return stats;
  }

  /**
   * Get payment statistics for a specific chain.
   */
  async getStatsForChain(chain: SupportedChain): Promise<ChainPaymentStats> {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.blockchain_network', 'chain')
      .addSelect('COUNT(*)', 'totalPayments')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'totalVolume')
      .addSelect('COALESCE(SUM(payment.platform_fee), 0)', 'totalFees')
      .addSelect(
        `COUNT(*) FILTER (WHERE payment.status = '${PaymentStatus.COMPLETED}')`,
        'completedPayments',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE payment.status = '${PaymentStatus.FAILED}')`,
        'failedPayments',
      )
      .where('payment.blockchain_network = :chain', { chain })
      .groupBy('payment.blockchain_network')
      .getRawOne();

    return (
      result || {
        chain,
        totalPayments: 0,
        totalVolume: '0',
        totalFees: '0',
        completedPayments: 0,
        failedPayments: 0,
      }
    );
  }

  /**
   * Get a summary of payment volume across all chains over a time period.
   */
  async getCrossChainVolume(
    days: number = 30,
  ): Promise<{ chain: string; date: string; volume: string }[]> {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.blockchain_network', 'chain')
      .addSelect('DATE(payment.created_at)', 'date')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'volume')
      .where('payment.created_at >= NOW() - INTERVAL :days DAY', { days })
      .andWhere('payment.status = :status', {
        status: PaymentStatus.COMPLETED,
      })
      .groupBy('payment.blockchain_network')
      .addGroupBy('DATE(payment.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return result;
  }
}
