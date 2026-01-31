import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { RoomPayment, PaymentStatus } from '../entities/room-payment.entity';
import { UserRoomAccess } from '../entities/user-room-access.entity';
import { Room } from '../entities/room.entity';
import { PaymentVerificationService } from './payment-verification.service';
import { PayEntryDto } from '../dto/pay-entry.dto';
import { PaymentStatusDto } from '../dto/payment-status.dto';
import { RefundPaymentDto } from '../dto/refund-payment.dto';
import { WithdrawFundsDto } from '../dto/withdraw-funds.dto';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';
import { UserStatsService } from '../../users/services/user-stats.service';

@Injectable()
export class RoomPaymentService {
  private readonly logger = new Logger(RoomPaymentService.name);

  constructor(
    @InjectRepository(RoomPayment)
    private paymentRepository: Repository<RoomPayment>,
    @InjectRepository(UserRoomAccess)
    private accessRepository: Repository<UserRoomAccess>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    private paymentVerificationService: PaymentVerificationService,
    private userStatsService: UserStatsService,
  ) {}

  async payRoomEntry(
    roomId: string,
    userId: string,
    userAddress: string,
    payEntryDto: PayEntryDto,
  ): Promise<PaymentStatusDto> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['creator']
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (!room.isTokenGated && !room.paymentRequired) {
      throw new BadRequestException('This room does not require payment');
    }

    // Check if user already has access
    const existingAccess = await this.checkUserAccess(userId, roomId);
    if (existingAccess.hasAccess && !existingAccess.isExpired) {
      throw new BadRequestException('You already have access to this room');
    }

    // Handle free trial
    if (payEntryDto.useFreeTrial && room.freeTrialEnabled) {
      return await this.grantFreeTrial(userId, roomId, room);
    }

    // Check for duplicate transaction
    const existingPayment = await this.paymentRepository.findOne({
      where: { transactionHash: payEntryDto.transactionHash }
    });

    if (existingPayment) {
      throw new BadRequestException('This transaction has already been processed');
    }

    // Verify blockchain transaction on the specified chain
    const chain = (payEntryDto.blockchainNetwork as SupportedChain) || SupportedChain.ETHEREUM;
    const verification = await this.paymentVerificationService.verifyTransaction(
      payEntryDto.transactionHash,
      room.entryFee,
      roomId,
      userAddress,
      chain,
    );

    if (!verification.verified) {
      throw new BadRequestException('Transaction verification failed');
    }

    // Create payment record
    const payment = this.paymentRepository.create({
      roomId,
      userId,
      amount: verification.amount,
      platformFee: verification.platformFee,
      creatorAmount: verification.creatorAmount,
      transactionHash: payEntryDto.transactionHash,
      blockchainNetwork: payEntryDto.blockchainNetwork || 'ethereum',
      status: PaymentStatus.COMPLETED,
      accessGranted: true,
      accessExpiresAt: room.accessDurationDays
        ? new Date(Date.now() + room.accessDurationDays * 24 * 60 * 60 * 1000)
        : null,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    const amount = Number.parseFloat(savedPayment.amount) || 0;
    await this.userStatsService.recordTokensTransferred(userId, amount, true);
    if (room.creator?.id && room.creator.id !== userId) {
      await this.userStatsService.recordTokensTransferred(room.creator.id, amount, false);
    }

    // Grant access
    await this.grantAccess(userId, roomId, savedPayment.id, savedPayment.accessExpiresAt);

    this.logger.log(`Payment processed for user ${userId} in room ${roomId}`);

    return this.mapPaymentToDto(savedPayment);
  }

  private async grantFreeTrial(
    userId: string,
    roomId: string,
    room: Room
  ): Promise<PaymentStatusDto> {
    // Check if user has already used free trial
    const previousTrial = await this.accessRepository.findOne({
      where: { userId, roomId, isFreeTrial: true }
    });

    if (previousTrial) {
      throw new BadRequestException('Free trial already used for this room');
    }

    const expiresAt = new Date(Date.now() + room.freeTrialDurationHours * 60 * 60 * 1000);

    const access = this.accessRepository.create({
      userId,
      roomId,
      hasAccess: true,
      isFreeTrial: true,
      accessExpiresAt: expiresAt,
    });

    await this.accessRepository.save(access);

    return {
      paymentId: 'free-trial',
      status: 'completed',
      transactionHash: 'free-trial',
      amount: '0',
      platformFee: '0',
      creatorAmount: '0',
      accessGranted: true,
      accessExpiresAt: expiresAt,
      createdAt: new Date(),
    };
  }

  private async grantAccess(
    userId: string,
    roomId: string,
    paymentId: string,
    expiresAt: Date | null
  ): Promise<void> {
    const existingAccess = await this.accessRepository.findOne({
      where: { userId, roomId }
    });

    if (existingAccess) {
      existingAccess.hasAccess = true;
      existingAccess.isFreeTrial = false;
      existingAccess.accessExpiresAt = expiresAt;
      existingAccess.paymentId = paymentId;
      await this.accessRepository.save(existingAccess);
    } else {
      const access = this.accessRepository.create({
        userId,
        roomId,
        hasAccess: true,
        isFreeTrial: false,
        accessExpiresAt: expiresAt,
        paymentId,
      });
      await this.accessRepository.save(access);
    }
  }

  async checkUserAccess(userId: string, roomId: string): Promise<{
    hasAccess: boolean;
    isExpired: boolean;
    expiresAt: Date | null;
  }> {
    const access = await this.accessRepository.findOne({
      where: { userId, roomId }
    });

    if (!access || !access.hasAccess) {
      return { hasAccess: false, isExpired: false, expiresAt: null };
    }

    const isExpired = access.accessExpiresAt && access.accessExpiresAt < new Date();

    if (isExpired) {
      access.hasAccess = false;
      await this.accessRepository.save(access);
      return { hasAccess: false, isExpired: true, expiresAt: access.accessExpiresAt };
    }

    return {
      hasAccess: true,
      isExpired: false,
      expiresAt: access.accessExpiresAt,
    };
  }

  async getPaymentStatus(paymentId: string, userId: string): Promise<PaymentStatusDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId }
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.mapPaymentToDto(payment);
  }

  async getUserPaymentHistory(userId: string, roomId?: string): Promise<PaymentStatusDto[]> {
    const where: any = { userId };
    if (roomId) {
      where.roomId = roomId;
    }

    const payments = await this.paymentRepository.find({
      where,
      order: { createdAt: 'DESC' }
    });

    return payments.map((p: any) => this.mapPaymentToDto(p));
  }

  async refundPayment(refundDto: RefundPaymentDto, adminUserId: string): Promise<PaymentStatusDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id: refundDto.paymentId },
      relations: ['room', 'user']
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Payment already refunded');
    }

    // Update payment
    payment.status = PaymentStatus.REFUNDED;
    payment.refundTransactionHash = refundDto.refundTransactionHash;
    payment.refundedAt = new Date();
    payment.notes = refundDto.reason || 'Refunded by admin';
    payment.accessGranted = false;

    await this.paymentRepository.save(payment);

    // Revoke access
    await this.accessRepository.update(
      { paymentId: payment.id },
      { hasAccess: false }
    );

    this.logger.log(`Payment ${payment.id} refunded by admin ${adminUserId}`);

    return this.mapPaymentToDto(payment);
  }

  async expireOldPayments(): Promise<void> {
    const expiredAccess = await this.accessRepository.find({
      where: {
        hasAccess: true,
        accessExpiresAt: MoreThan(new Date())
      }
    });

    for (const access of expiredAccess) {
      access.hasAccess = false;
      await this.accessRepository.save(access);

      if (access.paymentId) {
        await this.paymentRepository.update(
          { id: access.paymentId },
          { status: PaymentStatus.EXPIRED, accessGranted: false }
        );
      }
    }

    this.logger.log(`Expired ${expiredAccess.length} room access entries`);
  }

  async getRoomRevenue(roomId: string): Promise<{ totalRevenue: string; platformFees: string; creatorEarnings: string }> {
    const payments = await this.paymentRepository.find({
      where: { roomId, status: PaymentStatus.COMPLETED }
    });

    const totalRevenue = payments.reduce((acc: number, p: any) => acc + parseFloat(p.amount), 0);
    const platformFees = payments.reduce((acc: number, p: any) => acc + parseFloat(p.platformFee), 0);
    const creatorEarnings = payments.reduce((acc: number, p: any) => acc + parseFloat(p.creatorAmount), 0);

    return {
      totalRevenue: totalRevenue.toString(),
      platformFees: platformFees.toString(),
      creatorEarnings: creatorEarnings.toString()
    };
  }

  async getCreatorEarnings(userId: string): Promise<{ totalEarned: string; totalWithdrawn: string; balance: string }> {
    // This assumes we have a way to track withdrawals in the DB.
    // For now, let's aggregate from payments in creator's rooms.
    const rooms = await this.roomRepository.find({
      where: { creator: { id: userId } as any }
    });

    const roomIds = rooms.map((r: any) => r.id);
    if (roomIds.length === 0) {
      return { totalEarned: '0', totalWithdrawn: '0', balance: '0' };
    }

    const payments = await this.paymentRepository.createQueryBuilder('payment')
      .where('payment.roomId IN (:...roomIds)', { roomIds })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getMany();

    const totalEarned = payments.reduce((acc: number, p: any) => acc + parseFloat(p.creatorAmount), 0);
    
    // In a real app, we would subtract actual withdrawals from a withdrawals table.
    // For this implementation, we'll return the total earned as balance.
    return {
      totalEarned: totalEarned.toString(),
      totalWithdrawn: '0',
      balance: totalEarned.toString()
    };
  }

  async withdrawFunds(userId: string, withdrawDto: WithdrawFundsDto): Promise<{ transactionHash: string; amount: string; status: string }> {
    const earnings = await this.getCreatorEarnings(userId);
    const amountToWithdraw = parseFloat(withdrawDto.amount);
    const balance = parseFloat(earnings.balance);

    if (amountToWithdraw <= 0) {
       throw new BadRequestException('Withdrawal amount must be positive');
    }

    if (amountToWithdraw > balance) {
      throw new BadRequestException('Insufficient balance');
    }

    // Here we would call the blockchain service to actually transfer funds
    // For now, we simulate a successful withdrawal
    const transactionHash = `simulated-withdrawal-${Date.now()}`;

    this.logger.log(`User ${userId} withdrew ${withdrawDto.amount} to ${withdrawDto.address}`);

    return {
      transactionHash,
      amount: withdrawDto.amount,
      status: 'completed'
    };
  }

  private mapPaymentToDto(payment: RoomPayment): PaymentStatusDto {
    return {
      paymentId: payment.id,
      status: payment.status,
      transactionHash: payment.transactionHash,
      amount: payment.amount,
      platformFee: payment.platformFee,
      creatorAmount: payment.creatorAmount,
      accessGranted: payment.accessGranted,
      accessExpiresAt: payment.accessExpiresAt,
      createdAt: payment.createdAt,
    };
  }
}
