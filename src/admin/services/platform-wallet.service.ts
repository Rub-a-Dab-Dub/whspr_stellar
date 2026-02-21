import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { ChainService } from '../../chain/chain.service';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';
import { PlatformWalletWithdrawal, WithdrawalStatus } from '../entities/platform-wallet-withdrawal.entity';
import { WithdrawalWhitelist } from '../entities/withdrawal-whitelist.entity';
import { RoomPayment, PaymentStatus } from '../../room/entities/room-payment.entity';
import { PlatformWalletWithdrawDto } from '../dto/platform-wallet-withdraw.dto';
import { GetWithdrawalsDto } from '../dto/get-withdrawals.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditSeverity } from '../entities/audit-log.entity';
import { Request } from 'express';

@Injectable()
export class PlatformWalletService {
  private readonly logger = new Logger(PlatformWalletService.name);

  constructor(
    @InjectRepository(PlatformWalletWithdrawal)
    private readonly withdrawalRepository: Repository<PlatformWalletWithdrawal>,
    @InjectRepository(WithdrawalWhitelist)
    private readonly whitelistRepository: Repository<WithdrawalWhitelist>,
    @InjectRepository(RoomPayment)
    private readonly roomPaymentRepository: Repository<RoomPayment>,
    private readonly chainService: ChainService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    @InjectQueue(QUEUE_NAMES.BLOCKCHAIN_TASKS)
    private readonly blockchainQueue: Queue,
  ) {}

  /**
   * Get platform wallet information including balance per chain, total fees, and pending transactions
   */
  async getPlatformWalletInfo(): Promise<{
    balances: Record<string, { balance: string; address: string }>;
    totalAccumulatedFees: string;
    pendingTransactionsCount: number;
  }> {
    const chains = this.chainService.getAllChains();
    const balances: Record<string, { balance: string; address: string }> = {};

    // Get balance for each chain
    for (const { chain, config } of chains) {
      try {
        const provider = this.chainService.getProvider(chain);
        const walletAddress = this.getPlatformWalletAddress(chain);

        if (!walletAddress) {
          this.logger.warn(`No platform wallet address configured for chain ${chain}`);
          balances[chain] = { balance: '0', address: '' };
          continue;
        }

        const balance = await provider.getBalance(walletAddress);
        const balanceInEth = ethers.formatEther(balance);

        balances[chain] = {
          balance: balanceInEth,
          address: walletAddress,
        };
      } catch (error) {
        this.logger.error(`Failed to get balance for chain ${chain}:`, error);
        balances[chain] = { balance: '0', address: '' };
      }
    }

    // Calculate total accumulated fees from database
    const totalFees = await this.calculateTotalAccumulatedFees();

    // Count pending transactions
    const pendingCount = await this.roomPaymentRepository.count({
      where: { status: PaymentStatus.PENDING },
    });

    return {
      balances,
      totalAccumulatedFees: totalFees.toString(),
      pendingTransactionsCount: pendingCount,
    };
  }

  /**
   * Initiate a withdrawal from the platform wallet
   */
  async initiateWithdrawal(
    withdrawDto: PlatformWalletWithdrawDto,
    adminId: string,
    req?: Request,
  ): Promise<{ jobId: string; withdrawalId: string }> {
    // Validate chain
    const chain = this.chainService.validateChain(withdrawDto.chain) as SupportedChain;

    // Check if address is whitelisted
    const isWhitelisted = await this.whitelistRepository.findOne({
      where: { address: withdrawDto.toAddress.toLowerCase(), isActive: true },
    });

    if (!isWhitelisted) {
      await this.auditLogService.logAudit(
        adminId,
        AuditAction.PLATFORM_WALLET_WITHDRAWAL_ATTEMPTED,
        null,
        `Withdrawal attempt to non-whitelisted address: ${withdrawDto.toAddress}`,
        {
          chain: withdrawDto.chain,
          amount: withdrawDto.amount,
          toAddress: withdrawDto.toAddress,
          reason: withdrawDto.reason,
        },
        req,
        AuditSeverity.HIGH,
        'platform_wallet',
        null,
      );

      throw new ForbiddenException(
        'Withdrawal address is not whitelisted',
      );
    }

    // Get current balance
    const walletAddress = this.getPlatformWalletAddress(chain);
    if (!walletAddress) {
      throw new BadRequestException(
        `No platform wallet address configured for chain ${chain}`,
      );
    }

    const provider = this.chainService.getProvider(chain);
    const balance = await provider.getBalance(walletAddress);
    const balanceInEth = parseFloat(ethers.formatEther(balance));

    // Check reserve amount
    const reserveAmount = parseFloat(
      this.configService.get<string>('PLATFORM_WALLET_RESERVE', '0'),
    );

    const availableBalance = balanceInEth - reserveAmount;
    const withdrawalAmount = parseFloat(withdrawDto.amount);

    if (withdrawalAmount > availableBalance) {
      await this.auditLogService.logAudit(
        adminId,
        AuditAction.PLATFORM_WALLET_WITHDRAWAL_ATTEMPTED,
        null,
        `Withdrawal amount exceeds available balance`,
        {
          chain: withdrawDto.chain,
          requestedAmount: withdrawDto.amount,
          availableBalance: availableBalance.toString(),
          reserveAmount: reserveAmount.toString(),
        },
        req,
        AuditSeverity.HIGH,
        'platform_wallet',
        null,
      );

      throw new BadRequestException(
        `Withdrawal amount exceeds available balance. Available: ${availableBalance}, Reserve: ${reserveAmount}`,
      );
    }

    // Create withdrawal record
    const withdrawal = this.withdrawalRepository.create({
      chain: withdrawDto.chain,
      amount: withdrawDto.amount,
      toAddress: withdrawDto.toAddress.toLowerCase(),
      reason: withdrawDto.reason,
      status: WithdrawalStatus.PENDING,
      initiatedBy: adminId,
    });

    const savedWithdrawal = await this.withdrawalRepository.save(withdrawal);

    // Queue withdrawal job
    const job = await this.blockchainQueue.add(
      'process-platform-wallet-withdrawal',
      {
        withdrawalId: savedWithdrawal.id,
        chain: withdrawDto.chain,
        amount: withdrawDto.amount,
        toAddress: withdrawDto.toAddress,
        reason: withdrawDto.reason,
        adminId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    // Update withdrawal with job ID
    savedWithdrawal.jobId = job.id.toString();
    await this.withdrawalRepository.save(savedWithdrawal);

    // Log audit
    await this.auditLogService.logAudit(
      adminId,
      AuditAction.PLATFORM_WALLET_WITHDRAWAL_INITIATED,
      null,
      `Platform wallet withdrawal initiated: ${withdrawDto.amount} ${withdrawDto.chain} to ${withdrawDto.toAddress}`,
      {
        withdrawalId: savedWithdrawal.id,
        chain: withdrawDto.chain,
        amount: withdrawDto.amount,
        toAddress: withdrawDto.toAddress,
        reason: withdrawDto.reason,
        jobId: job.id.toString(),
      },
      req,
      AuditSeverity.HIGH,
      'platform_wallet',
      savedWithdrawal.id,
    );

    return {
      jobId: job.id.toString(),
      withdrawalId: savedWithdrawal.id,
    };
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawals(
    query: GetWithdrawalsDto,
  ): Promise<{
    withdrawals: PlatformWalletWithdrawal[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { status, chain, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.withdrawalRepository.createQueryBuilder('withdrawal');

    if (status) {
      queryBuilder.andWhere('withdrawal.status = :status', { status });
    }

    if (chain) {
      queryBuilder.andWhere('withdrawal.chain = :chain', { chain });
    }

    queryBuilder.orderBy('withdrawal.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [withdrawals, total] = await queryBuilder.getManyAndCount();

    return {
      withdrawals,
      total,
      page,
      limit,
    };
  }

  /**
   * Get platform wallet address for a chain from config
   */
  private getPlatformWalletAddress(chain: SupportedChain): string | null {
    const chainKey = chain.toUpperCase();
    return (
      this.configService.get<string>(`CHAIN_${chainKey}_PLATFORM_WALLET_ADDRESS`) ||
      this.configService.get<string>(`CHAIN_${chainKey}_ACCOUNT_ADDRESS`) ||
      null
    );
  }

  /**
   * Calculate total accumulated fees from database
   */
  private async calculateTotalAccumulatedFees(): Promise<number> {
    const result = await this.roomPaymentRepository
      .createQueryBuilder('payment')
      .select('SUM(CAST(payment.platformFee AS DECIMAL))', 'total')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getRawOne();

    return parseFloat(result?.total || '0');
  }
}
