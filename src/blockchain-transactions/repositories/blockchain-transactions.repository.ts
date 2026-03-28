import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  BlockchainTransaction,
  BlockchainTransactionStatus,
  BlockchainTransactionType,
} from '../entities/blockchain-transaction.entity';

@Injectable()
export class BlockchainTransactionsRepository extends Repository<BlockchainTransaction> {
  constructor(dataSource: DataSource) {
    super(BlockchainTransaction, dataSource.createEntityManager());
  }

  async findByTxHash(txHash: string): Promise<BlockchainTransaction | null> {
    return this.findOne({ where: { txHash } });
  }

  async findByReferenceId(referenceId: string): Promise<BlockchainTransaction | null> {
    return this.findOne({ where: { referenceId } });
  }

  async findUserTransactionsPaginated(
    userId: string,
    page: number,
    limit: number,
    type?: BlockchainTransactionType,
    status?: BlockchainTransactionStatus,
  ): Promise<[BlockchainTransaction[], number]> {
    const query = this.createQueryBuilder('bt')
      .where('bt.userId = :userId', { userId })
      .orderBy('bt.createdAt', 'DESC');

    if (type) {
      query.andWhere('bt.type = :type', { type });
    }

    if (status) {
      query.andWhere('bt.status = :status', { status });
    }

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    return query.getManyAndCount();
  }

  async existsWithReferenceId(referenceId: string): Promise<boolean> {
    const count = await this.count({ where: { referenceId } });
    return count > 0;
  }

  async findPendingTransactionsByUser(userId: string): Promise<BlockchainTransaction[]> {
    return this.find({
      where: {
        userId,
        status: BlockchainTransactionStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });
  }
}
