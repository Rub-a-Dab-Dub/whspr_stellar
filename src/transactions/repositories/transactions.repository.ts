import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { Transaction, TransactionStatus, TransactionType } from '../entities/transaction.entity';

export interface TransactionsQueryFilters {
  addresses?: string[];
  conversationId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  network?: string;
  search?: string;
  page: number;
  limit: number;
}

@Injectable()
export class TransactionsRepository extends Repository<Transaction> {
  constructor(private readonly dataSource: DataSource) {
    super(Transaction, dataSource.createEntityManager());
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.findOne({ where: { id } });
  }

  async findByTxHash(txHash: string): Promise<Transaction | null> {
    return this.findOne({ where: { txHash } });
  }

  async findPending(limit = 100): Promise<Transaction[]> {
    return this.find({
      where: { status: TransactionStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async search(filters: TransactionsQueryFilters): Promise<{
    items: Transaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const qb = this.createQueryBuilder('tx');

    if (filters.addresses?.length) {
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('LOWER(tx.fromAddress) IN (:...addresses)', {
              addresses: filters.addresses.map((address) => address.toLowerCase()),
            })
            .orWhere('LOWER(tx.toAddress) IN (:...addresses)', {
              addresses: filters.addresses.map((address) => address.toLowerCase()),
            });
        }),
      );
    }

    if (filters.conversationId) {
      qb.andWhere('tx.conversationId = :conversationId', {
        conversationId: filters.conversationId,
      });
    }

    if (filters.type) {
      qb.andWhere('tx.type = :type', { type: filters.type });
    }

    if (filters.status) {
      qb.andWhere('tx.status = :status', { status: filters.status });
    }

    if (filters.network) {
      qb.andWhere('tx.network = :network', { network: filters.network });
    }

    if (filters.search) {
      const normalizedSearch = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('LOWER(tx.txHash) LIKE :search', { search: normalizedSearch })
            .orWhere('LOWER(tx.fromAddress) LIKE :search', { search: normalizedSearch })
            .orWhere('LOWER(tx.toAddress) LIKE :search', { search: normalizedSearch })
            .orWhere('LOWER(tx.tokenId) LIKE :search', { search: normalizedSearch })
            .orWhere("COALESCE(CAST(tx.messageId AS text), '') LIKE :search", {
              search: `%${filters.search.trim()}%`,
            });
        }),
      );
    }

    qb.orderBy('tx.createdAt', 'DESC').addOrderBy('tx.id', 'DESC');

    const page = filters.page;
    const limit = filters.limit;

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, limit };
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    options?: { ledger?: string | null; confirmedAt?: Date | null; failureReason?: string | null },
  ): Promise<void> {
    await this.update(
      { id },
      {
        status,
        ledger: options?.ledger ?? null,
        confirmedAt: options?.confirmedAt ?? null,
        failureReason: options?.failureReason ?? null,
      },
    );
  }

  async countByStatuses(statuses: TransactionStatus[]): Promise<number> {
    return this.count({ where: { status: In(statuses) } });
  }
}
