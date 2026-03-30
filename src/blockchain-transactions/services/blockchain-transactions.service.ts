import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { BlockchainTransactionsRepository } from '../repositories/blockchain-transactions.repository';
import {
  BlockchainTransaction,
  BlockchainTransactionStatus,
  BlockchainTransactionType,
} from '../entities/blockchain-transaction.entity';
import {
  CreateBlockchainTransactionDto,
  UpdateBlockchainTransactionStatusDto,
  ListBlockchainTransactionsQueryDto,
} from '../dto/blockchain-transaction.dto';
import { BlockchainTransactionListResponseDto } from '../dto/blockchain-transaction-response.dto';

@Injectable()
export class BlockchainTransactionsService {
  constructor(private readonly repository: BlockchainTransactionsRepository) {}

  /**
   * Create a new blockchain transaction record
   * Stores as pending until submitted to the blockchain
   */
  async createTransaction(
    dto: CreateBlockchainTransactionDto,
  ): Promise<BlockchainTransaction> {
    // Check for idempotency - ensure referenceId is unique
    const existing = await this.repository.findByReferenceId(dto.referenceId);
    if (existing) {
      throw new BadRequestException(
        `Transaction with referenceId ${dto.referenceId} already exists`,
      );
    }

    const transaction = this.repository.create({
      userId: dto.userId,
      type: dto.type,
      fromAddress: dto.fromAddress,
      toAddress: dto.toAddress || null,
      amountUsdc: dto.amountUsdc,
      referenceId: dto.referenceId,
      status: BlockchainTransactionStatus.PENDING,
    });

    return this.repository.save(transaction);
  }

  /**
   * Update transaction status with blockchain details
   * Idempotent - subsequent calls with same txHash will not update
   */
  async updateTransactionStatus(
    id: string,
    dto: UpdateBlockchainTransactionStatusDto,
  ): Promise<BlockchainTransaction> {
    const transaction = await this.repository.findOneBy({ id });
    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    // If txHash is already set and differs from new one, don't update
    // to maintain idempotency
    if (transaction.txHash && dto.txHash && transaction.txHash !== dto.txHash) {
      throw new BadRequestException(
        'Transaction already has a different txHash. Cannot modify.',
      );
    }

    // Update fields
    if (dto.txHash) {
      transaction.txHash = dto.txHash;
    }

    transaction.status = dto.status;

    if (dto.ledger !== undefined) {
      transaction.ledger = dto.ledger;
    }

    if (dto.errorMessage !== undefined) {
      transaction.errorMessage = dto.errorMessage;
    }

    if (dto.feeStroops !== undefined) {
      transaction.feeStroops = dto.feeStroops.toString();
    }

    // Set confirmedAt when status changes to confirmed
    if (dto.status === BlockchainTransactionStatus.CONFIRMED && !transaction.confirmedAt) {
      transaction.confirmedAt = new Date();
    }

    return this.repository.save(transaction);
  }

  /**
   * Find transaction by reference ID (business entity ID)
   */
  async findByReferenceId(referenceId: string): Promise<BlockchainTransaction | null> {
    return this.repository.findByReferenceId(referenceId);
  }

  /**
   * Find transaction by blockchain txHash
   */
  async findByTxHash(txHash: string): Promise<BlockchainTransaction | null> {
    return this.repository.findByTxHash(txHash);
  }

  /**
   * Get user's transactions with pagination and filtering
   */
  async getUserTransactions(
    userId: string,
    query: ListBlockchainTransactionsQueryDto,
  ): Promise<BlockchainTransactionListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const [transactions, total] = await this.repository.findUserTransactionsPaginated(
      userId,
      page,
      limit,
      query.type,
      query.status,
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get a single transaction by ID
   */
  async getTransaction(id: string): Promise<BlockchainTransaction> {
    const transaction = await this.repository.findOneBy({ id });
    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    return transaction;
  }

  /**
   * Check if a transaction exists for a reference ID
   * Used for idempotency checks before submission
   */
  async checkIdempotency(referenceId: string): Promise<BlockchainTransaction | null> {
    return this.repository.findByReferenceId(referenceId);
  }

  /**
   * Verify user owns the transaction
   */
  async verifyUserOwnership(transactionId: string, userId: string): Promise<boolean> {
    const transaction = await this.repository.findOneBy({ id: transactionId });
    if (!transaction) {
      return false;
    }
    return transaction.userId === userId;
  }
}
