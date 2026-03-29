import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationType } from '../../messaging/dto/notification-events.dto';
import { ChatGateway } from '../../messaging/gateways/chat.gateway';
import { NotificationsGateway } from '../../messaging/gateways/notifications.gateway';
import { InAppNotificationType } from '../../notifications/entities/notification.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { Wallet, WalletNetwork } from '../../wallets/entities/wallet.entity';
import { SavedAddressesService } from '../../address-book/saved-addresses.service';
import { ListTransactionsQueryDto } from '../dto/list-transactions-query.dto';
import {
  TransactionListResponseDto,
  TransactionResponseDto,
} from '../dto/transaction-response.dto';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';
import { TransactionsRepository } from '../repositories/transactions.repository';
import { SorobanTransactionsService } from './soroban-transactions.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AmlMonitoringService } from '../../aml/aml-monitoring.service';

export interface CreateTransactionInput {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  tokenId: string;
  amount: string;
  fee: string;
  status?: TransactionStatus;
  type: TransactionType;
  conversationId?: string | null;
  messageId?: string | null;
  network: string;
  ledger?: string | null;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly sorobanTransactionsService: SorobanTransactionsService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly chatGateway: ChatGateway,
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    private readonly savedAddressesService: SavedAddressesService,
    private readonly amlService: AmlMonitoringService,
    @InjectQueue('aml-analysis')
    private readonly amlQueue: Queue<{ txId: string }>,
  ) {}

  async createTransaction(input: CreateTransactionInput): Promise<TransactionResponseDto> {
    const existing = await this.transactionsRepository.findByTxHash(input.txHash);
    if (existing) {
      return this.toDto(existing);
    }

    const transaction = this.transactionsRepository.create({
      txHash: input.txHash,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      tokenId: input.tokenId,
      amount: input.amount,
      fee: input.fee,
      status: input.status ?? TransactionStatus.PENDING,
      type: input.type,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      network: input.network,
      ledger: input.ledger ?? null,
      failureReason: null,
      confirmedAt: null,
    });

    const saved = await this.transactionsRepository.save(transaction);
    return this.toDto(saved);
  }

  async updateStatus(
    transactionId: string,
    status: TransactionStatus,
    options?: { ledger?: string | null; failureReason?: string | null; confirmedAt?: Date | null },
  ): Promise<TransactionResponseDto> {
    const existing = await this.transactionsRepository.findById(transactionId);
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    const nextConfirmedAt =
      status === TransactionStatus.CONFIRMED
        ? options?.confirmedAt ?? existing.confirmedAt ?? new Date()
        : null;

    await this.transactionsRepository.updateStatus(existing.id, status, {
      ledger: options?.ledger ?? existing.ledger,
      failureReason: status === TransactionStatus.FAILED ? options?.failureReason ?? null : null,
      confirmedAt: nextConfirmedAt,
    });

    const updated = await this.transactionsRepository.findById(existing.id);
    if (!updated) {
      throw new NotFoundException('Transaction not found after update');
    }

    if (updated.status !== existing.status || updated.ledger !== existing.ledger) {
      await this.handleStatusChange(updated);
    }

    // AML analysis for confirmed transactions
    if (updated.status === TransactionStatus.CONFIRMED) {
      await this.amlQueue.add('analyze-transaction', { txId: updated.id });
    }

    return this.toDto(updated);
  }

  async getTransaction(
    userId: string,
    transactionId: string,
    walletAddress?: string,
  ): Promise<TransactionResponseDto> {
    const tx = await this.transactionsRepository.findById(transactionId);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    const addresses = await this.resolveUserAddresses(userId, walletAddress);
    const allowed = this.isOwnedByAddresses(tx, addresses);
    if (!allowed) {
      throw new NotFoundException('Transaction not found');
    }

    return this.toDto(tx);
  }

  async getUserTransactions(
    userId: string,
    walletAddress: string | undefined,
    query: ListTransactionsQueryDto,
  ): Promise<TransactionListResponseDto> {
    const addresses = await this.resolveUserAddresses(userId, walletAddress);

    const result = await this.transactionsRepository.search({
      addresses,
      type: query.type,
      status: query.status,
      network: query.network,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: result.items.map((tx) => this.toDto(tx)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getConversationTransactions(
    userId: string,
    walletAddress: string | undefined,
    conversationId: string,
    query: ListTransactionsQueryDto,
  ): Promise<TransactionListResponseDto> {
    const addresses = await this.resolveUserAddresses(userId, walletAddress);

    const result = await this.transactionsRepository.search({
      addresses,
      conversationId,
      type: query.type,
      status: query.status,
      network: query.network,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: result.items.map((tx) => this.toDto(tx)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async retryFailed(
    userId: string,
    walletAddress: string | undefined,
    transactionId: string,
  ): Promise<TransactionResponseDto> {
    const tx = await this.transactionsRepository.findById(transactionId);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    const addresses = await this.resolveUserAddresses(userId, walletAddress);
    if (!this.isOwnedByAddresses(tx, addresses)) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.status !== TransactionStatus.FAILED) {
      throw new BadRequestException('Retry is only available for FAILED transactions');
    }

    return this.updateStatus(transactionId, TransactionStatus.PENDING, {
      ledger: tx.ledger,
      failureReason: null,
      confirmedAt: null,
    });
  }

  async pollPendingStatuses(limit = 100): Promise<number> {
    const pending = await this.transactionsRepository.findPending(limit);
    let updatedCount = 0;

    for (const tx of pending) {
      const statusResult = await this.sorobanTransactionsService.getTransactionStatus(tx.txHash);

      if (statusResult.status === TransactionStatus.PENDING) {
        continue;
      }

      await this.updateStatus(tx.id, statusResult.status, {
        ledger: statusResult.ledger,
        failureReason: statusResult.failureReason,
        confirmedAt: statusResult.status === TransactionStatus.CONFIRMED ? new Date() : null,
      });

      updatedCount += 1;
    }

    return updatedCount;
  }

  private async handleStatusChange(transaction: Transaction): Promise<void> {
    const [senderId, recipientId] = await Promise.all([
      this.resolveUserIdByWalletAddress(transaction.fromAddress, transaction.network),
      this.resolveUserIdByWalletAddress(transaction.toAddress, transaction.network),
    ]);

    const transferPayload = {
      transferId: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.tokenId,
      txHash: transaction.txHash,
      failureReason: transaction.failureReason ?? undefined,
    };

    if (senderId) {
      await this.notificationsGateway.sendTransferUpdate(senderId, transferPayload);

      if (transaction.status === TransactionStatus.CONFIRMED) {
        await this.savedAddressesService.trackUsageByWalletAddress(senderId, transaction.toAddress);

        await this.notificationsService.createNotification({
          userId: senderId,
          type: InAppNotificationType.TRANSACTION_CONFIRMED,
          title: 'Transaction confirmed',
          body: 'Your transaction was confirmed on chain.',
          data: {
            transactionId: transaction.id,
            txHash: transaction.txHash,
            amount: transaction.amount,
            tokenId: transaction.tokenId,
          },
        });
      }
    }

    if (recipientId && recipientId !== senderId) {
      await this.notificationsGateway.sendTransferUpdate(recipientId, transferPayload);

      if (transaction.status === TransactionStatus.CONFIRMED) {
        await this.notificationsService.createNotification({
          userId: recipientId,
          type: InAppNotificationType.TRANSFER_RECEIVED,
          title: 'Transfer received',
          body: 'You received a confirmed transfer.',
          data: {
            transactionId: transaction.id,
            txHash: transaction.txHash,
            amount: transaction.amount,
            tokenId: transaction.tokenId,
            fromAddress: transaction.fromAddress,
          },
        });
      }
    }

    if (
      transaction.status === TransactionStatus.CONFIRMED &&
      transaction.conversationId &&
      transaction.messageId
    ) {
      await this.chatGateway.sendMessageReceipt(
        transaction.conversationId,
        transaction.messageId,
        transaction.id,
        transaction.txHash,
      );
    }

    if (transaction.status === TransactionStatus.FAILED && senderId) {
      await this.notificationsGateway.sendNotification(senderId, {
        id: transaction.id,
        type: NotificationType.TRANSFER,
        title: 'Transfer failed',
        body: transaction.failureReason || 'Your transfer failed on chain',
        data: {
          transactionId: transaction.id,
          txHash: transaction.txHash,
        },
      });
    }
  }

  private async resolveUserAddresses(userId: string, walletAddress?: string): Promise<string[]> {
    const wallets = await this.walletsRepository.find({
      where: { userId },
      select: ['walletAddress'],
    });

    const values = wallets.map((wallet) => wallet.walletAddress);
    if (walletAddress) {
      values.push(walletAddress);
    }

    return Array.from(new Set(values.map((value) => value.toLowerCase())));
  }

  private isOwnedByAddresses(transaction: Transaction, addresses: string[]): boolean {
    const from = transaction.fromAddress.toLowerCase();
    const to = transaction.toAddress.toLowerCase();
    return addresses.includes(from) || addresses.includes(to);
  }

  private async resolveUserIdByWalletAddress(
    walletAddress: string,
    network: string,
  ): Promise<string | null> {
    const normalized = walletAddress.toLowerCase();

    const inferredNetwork = this.toWalletNetwork(network);
    if (inferredNetwork) {
      const wallet = await this.walletsRepository.findOne({
        where: {
          walletAddress: normalized,
          network: inferredNetwork,
        },
        select: ['userId'],
      });

      if (wallet) {
        return wallet.userId;
      }
    }

    const wallet = await this.walletsRepository
      .createQueryBuilder('wallet')
      .select(['wallet.userId'])
      .where('LOWER(wallet.walletAddress) = :walletAddress', { walletAddress: normalized })
      .orderBy('wallet.createdAt', 'ASC')
      .getOne();

    return wallet?.userId ?? null;
  }

  private toWalletNetwork(network: string): WalletNetwork | null {
    if (network === WalletNetwork.STELLAR_MAINNET) {
      return WalletNetwork.STELLAR_MAINNET;
    }

    if (network === WalletNetwork.STELLAR_TESTNET) {
      return WalletNetwork.STELLAR_TESTNET;
    }

    return null;
  }

  private toDto(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction.id,
      txHash: transaction.txHash,
      fromAddress: transaction.fromAddress,
      toAddress: transaction.toAddress,
      tokenId: transaction.tokenId,
      amount: transaction.amount,
      fee: transaction.fee,
      status: transaction.status,
      type: transaction.type,
      conversationId: transaction.conversationId,
      messageId: transaction.messageId,
      network: transaction.network,
      ledger: transaction.ledger,
      failureReason: transaction.failureReason,
      confirmedAt: transaction.confirmedAt,
      createdAt: transaction.createdAt,
    };
  }
}
