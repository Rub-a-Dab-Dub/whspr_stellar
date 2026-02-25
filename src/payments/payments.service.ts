import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentType } from './entities/payment.entity';
import {
  RecipientResolutionService,
  ResolvedRecipient,
} from './services/recipient-resolution.service';
import { PaymentBlockchainService } from './services/payment-blockchain.service';
import { PaymentsGateway } from './payments.gateway';
import { User } from '../user/entities/user.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly recipientResolution: RecipientResolutionService,
    private readonly blockchainService: PaymentBlockchainService,
    private readonly paymentsGateway: PaymentsGateway,
  ) {}

  async createTransfer(
    senderId: string,
    recipient: string,
    amount: number,
    tokenAddress: string,
  ): Promise<Payment> {
    const resolved = await this.recipientResolution.resolve(
      recipient,
      senderId,
    );
    const sender = await this.userRepository.findOne({
      where: { id: senderId },
      select: ['id', 'walletAddress'],
    });

    if (!sender) {
      throw new NotFoundException('Sender user not found');
    }

    if (!sender.walletAddress) {
      throw new BadRequestException('Sender has no wallet address linked');
    }

    const amountStr = amount.toFixed(8);
    const payment = this.paymentRepository.create({
      senderId,
      recipientId: resolved.userId,
      recipientWalletAddress: resolved.walletAddress,
      amount: amountStr,
      tokenAddress: tokenAddress === 'native' ? null : tokenAddress,
      type: PaymentType.P2P,
      status: PaymentStatus.PENDING,
    });
    await this.paymentRepository.save(payment);

    this.executeTransferAsync(payment.id, sender.walletAddress, resolved);
    return payment;
  }

  private async executeTransferAsync(
    paymentId: string,
    senderWalletAddress: string,
    resolved: ResolvedRecipient,
  ): Promise<void> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['sender', 'recipient'],
      });

      if (!payment) {
        this.logger.error(`Payment ${paymentId} not found`);
        return;
      }

      payment.status = PaymentStatus.PROCESSING;
      await this.paymentRepository.save(payment);

      const tokenAddr = payment.tokenAddress ?? 'native';
      const result = await this.blockchainService.executeTransfer(
        senderWalletAddress,
        resolved.walletAddress,
        payment.amount,
        tokenAddr === 'native' ? null : tokenAddr,
      );

      if (result.success && result.transactionHash) {
        payment.status = PaymentStatus.COMPLETED;
        payment.transactionHash = result.transactionHash;
        payment.completedAt = new Date();
        await this.paymentRepository.save(payment);

        if (resolved.userId) {
          this.paymentsGateway.emitTransferReceived(resolved.userId, {
            paymentId: payment.id,
            amount: payment.amount,
            tokenAddress: payment.tokenAddress,
            senderId: payment.senderId,
            transactionHash: payment.transactionHash,
          });
        }
        this.logger.log(`Payment ${paymentId} completed`);
      } else {
        throw new Error(result.error ?? 'Transfer failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Payment ${paymentId} failed: ${message}`);
      await this.handleTransferFailure(paymentId, message);
    }
  }

  private async handleTransferFailure(
    paymentId: string,
    reason: string,
  ): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) return;

    payment.status = PaymentStatus.FAILED;
    payment.failureReason = reason;
    await this.paymentRepository.save(payment);
  }

  async getTransfers(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ payments: Payment[]; total: number }> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.sender', 'sender')
      .leftJoinAndSelect('payment.recipient', 'recipient')
      .where('payment.senderId = :userId OR payment.recipientId = :userId', {
        userId,
      })
      .andWhere('payment.type = :type', { type: PaymentType.P2P })
      .orderBy('payment.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [payments, total] = await queryBuilder.getManyAndCount();
    return { payments, total };
  }
}
