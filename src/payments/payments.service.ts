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
import { TransactionVerificationService } from './services/transaction-verification.service';
import { PaymentsGateway } from './payments.gateway';
import { User } from '../user/entities/user.entity';
import { Message, MessageType } from '../messages/entities/message.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly recipientResolution: RecipientResolutionService,
    private readonly blockchainService: PaymentBlockchainService,
    private readonly transactionVerification: TransactionVerificationService,
    private readonly paymentsGateway: PaymentsGateway,
  ) { }

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

  async createTip(
    senderId: string,
    recipientId: string,
    roomId: string,
    amount: number,
    tokenAddress: string,
    txHash: string,
  ): Promise<Payment> {
    // Check if transaction already processed
    const existingPayment = await this.paymentRepository.findOne({
      where: { transactionHash: txHash },
    });

    if (existingPayment) {
      throw new BadRequestException('Transaction already processed');
    }

    // Verify sender and recipient exist
    const [sender, recipient] = await Promise.all([
      this.userRepository.findOne({ where: { id: senderId }, select: ['id', 'walletAddress', 'xp'] }),
      this.userRepository.findOne({ where: { id: recipientId }, select: ['id', 'walletAddress', 'xp'] }),
    ]);

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    if (senderId === recipientId) {
      throw new BadRequestException('Cannot tip yourself');
    }

    // Verify transaction on-chain
    const verifiedTx = await this.transactionVerification.verifyTransaction(txHash);

    // Verify contract match
    if (!this.transactionVerification.verifyContractMatch(verifiedTx)) {
      throw new BadRequestException('Transaction not from correct contract');
    }

    // Verify amounts (2% platform fee)
    const { isValid, recipientAmount, platformFee } =
      this.transactionVerification.verifyAmounts(verifiedTx.amount, amount, 2);

    if (!isValid) {
      throw new BadRequestException('Transaction amount does not match expected amount');
    }

    // Create payment record
    const payment = this.paymentRepository.create({
      senderId,
      recipientId,
      recipientWalletAddress: recipient.walletAddress!,
      amount: amount.toFixed(8),
      tokenAddress: tokenAddress === 'native' ? null : tokenAddress,
      transactionHash: txHash,
      type: PaymentType.TIP,
      status: PaymentStatus.COMPLETED,
      roomId,
      completedAt: new Date(),
    });

    await this.paymentRepository.save(payment);

    // Award XP: +20 to sender, +5 to recipient
    sender.xp = (sender.xp || 0) + 20;
    recipient.xp = (recipient.xp || 0) + 5;
    await Promise.all([
      this.userRepository.save(sender),
      this.userRepository.save(recipient),
    ]);

    // Create TIP message in room
    const message = this.messageRepository.create({
      senderId,
      roomId,
      type: MessageType.TIP,
      paymentId: payment.id,
      content: `Tipped ${recipientAmount} tokens (${platformFee} platform fee)`,
    });
    await this.messageRepository.save(message);

    // Emit WebSocket event
    this.paymentsGateway.emitTipReceived(recipientId, {
      paymentId: payment.id,
      amount: payment.amount,
      tokenAddress: payment.tokenAddress,
      senderId,
      roomId,
      transactionHash: txHash,
    });

    this.logger.log(`Tip processed: ${senderId} -> ${recipientId}, amount: ${amount}, room: ${roomId}`);

    return payment;
  }

  async getPaymentHistory(
    userId: string,
    type?: 'sent' | 'received',
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ payments: Payment[]; total: number }> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.sender', 'sender')
      .leftJoinAndSelect('payment.recipient', 'recipient');

    if (type === 'sent') {
      queryBuilder.where('payment.senderId = :userId', { userId });
    } else if (type === 'received') {
      queryBuilder.where('payment.recipientId = :userId', { userId });
    } else {
      queryBuilder.where('payment.senderId = :userId OR payment.recipientId = :userId', { userId });
    }

    queryBuilder
      .orderBy('payment.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [payments, total] = await queryBuilder.getManyAndCount();
    return { payments, total };
  }
}
