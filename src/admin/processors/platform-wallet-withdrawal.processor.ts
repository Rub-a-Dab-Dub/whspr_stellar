import { Processor, Process } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import {
  PlatformWalletWithdrawal,
  WithdrawalStatus,
} from '../entities/platform-wallet-withdrawal.entity';
import { ChainService } from '../../chain/chain.service';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { AuditLogService } from '../services/audit-log.service';
import {
  AuditAction,
  AuditSeverity,
  AuditEventType,
} from '../entities/audit-log.entity';

@Processor(QUEUE_NAMES.BLOCKCHAIN_TASKS)
@Injectable()
export class PlatformWalletWithdrawalProcessor {
  private readonly logger = new Logger(PlatformWalletWithdrawalProcessor.name);

  constructor(
    @InjectRepository(PlatformWalletWithdrawal)
    private readonly withdrawalRepository: Repository<PlatformWalletWithdrawal>,
    private readonly chainService: ChainService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Process('process-platform-wallet-withdrawal')
  async handleWithdrawal(
    job: Job<{
      withdrawalId: string;
      chain: string;
      amount: string;
      toAddress: string;
      reason: string;
      adminId: string;
    }>,
  ) {
    this.logger.log(
      `Processing platform wallet withdrawal ${job.data.withdrawalId}`,
    );

    const { withdrawalId, chain, amount, toAddress, adminId } = job.data;

    try {
      // Get withdrawal record
      const withdrawal = await this.withdrawalRepository.findOne({
        where: { id: withdrawalId },
      });

      if (!withdrawal) {
        throw new Error(`Withdrawal ${withdrawalId} not found`);
      }

      // Update status to processing
      withdrawal.status = WithdrawalStatus.PROCESSING;
      await this.withdrawalRepository.save(withdrawal);

      await job.progress(20);

      // Get chain configuration
      const supportedChain = this.chainService.validateChain(chain);
      const provider = this.chainService.getProvider(supportedChain);

      // Get platform wallet private key
      const chainKey = supportedChain.toUpperCase();
      const privateKey =
        this.configService.get<string>(`CHAIN_${chainKey}_PRIVATE_KEY`) ||
        this.configService.get<string>(
          `CHAIN_${chainKey}_PLATFORM_WALLET_PRIVATE_KEY`,
        );

      if (!privateKey) {
        throw new Error(`No private key configured for chain ${chain}`);
      }

      // Create wallet from private key
      const wallet = new ethers.Wallet(privateKey, provider);

      await job.progress(40);

      // Prepare transaction
      const amountInWei = ethers.parseEther(amount);
      const gasPrice = await provider.getFeeData();
      const gasLimit = 21000; // Standard ETH transfer

      const tx = {
        to: toAddress,
        value: amountInWei,
        gasLimit,
        gasPrice: gasPrice.gasPrice,
      };

      await job.progress(60);

      // Send transaction
      const txResponse = await wallet.sendTransaction(tx);
      this.logger.log(
        `Withdrawal transaction sent: ${txResponse.hash} for withdrawal ${withdrawalId}`,
      );

      await job.progress(80);

      // Wait for transaction confirmation
      const receipt = await txResponse.wait();
      this.logger.log(
        `Withdrawal transaction confirmed: ${receipt.hash} for withdrawal ${withdrawalId}`,
      );

      // Update withdrawal record
      withdrawal.status = WithdrawalStatus.COMPLETED;
      withdrawal.transactionHash = receipt.hash;
      withdrawal.completedAt = new Date();
      await this.withdrawalRepository.save(withdrawal);

      await job.progress(100);

      // Log successful audit
      await this.auditLogService.createAuditLog({
        actorUserId: adminId,
        action: AuditAction.PLATFORM_WALLET_WITHDRAWAL_COMPLETED,
        eventType: AuditEventType.ADMIN,
        details: `Platform wallet withdrawal completed: ${amount} ${chain} to ${toAddress}`,
        metadata: {
          withdrawalId,
          chain,
          amount,
          toAddress,
          transactionHash: receipt.hash,
        },
        severity: AuditSeverity.HIGH,
        resourceType: 'platform_wallet',
        resourceId: withdrawalId,
      });

      this.logger.log(`Successfully processed withdrawal ${withdrawalId}`);
    } catch (error) {
      this.logger.error(`Error processing withdrawal ${withdrawalId}:`, error);

      // Update withdrawal record with failure
      const withdrawal = await this.withdrawalRepository.findOne({
        where: { id: withdrawalId },
      });

      if (withdrawal) {
        withdrawal.status = WithdrawalStatus.FAILED;
        withdrawal.failureReason = error.message || 'Unknown error';
        withdrawal.failedAt = new Date();
        await this.withdrawalRepository.save(withdrawal);

        // Log failed audit
        await this.auditLogService.createAuditLog({
          actorUserId: adminId,
          action: AuditAction.PLATFORM_WALLET_WITHDRAWAL_FAILED,
          eventType: AuditEventType.ADMIN,
          details: `Platform wallet withdrawal failed: ${error.message}`,
          metadata: {
            withdrawalId,
            chain,
            amount,
            toAddress,
            error: error.message,
          },
          severity: AuditSeverity.HIGH,
          resourceType: 'platform_wallet',
          resourceId: withdrawalId,
        });
      }

      throw error;
    }
  }
}
