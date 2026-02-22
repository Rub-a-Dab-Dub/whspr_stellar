import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WithdrawalRequest,
  WithdrawalStatus,
} from '../entities/withdrawal-request.entity';
import { AuditAction } from '../entities/withdrawal-audit-log.entity';
import {
  CreateWithdrawalRequestDto,
  RejectWithdrawalDto,
  WithdrawalRequestFilterDto,
} from '../dto/withdrawal.dto';
import { RiskScoringService } from './risk-scoring.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { BlockchainQueueService } from './blockchain-queue.service';

export interface AdminUser {
  id: string;
  username: string;
  ipAddress?: string;
}

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  private get autoApproveThreshold(): number {
    return parseFloat(process.env.AUTO_APPROVE_WITHDRAWAL_THRESHOLD || '100');
  }

  constructor(
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
    private readonly riskScoringService: RiskScoringService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
    private readonly blockchainQueueService: BlockchainQueueService,
  ) {}

  /**
   * Creates a new withdrawal request. Called from the user-facing side.
   * Automatically approves if below the threshold and low risk.
   */
  async createRequest(dto: CreateWithdrawalRequestDto): Promise<WithdrawalRequest> {
    const risk = await this.riskScoringService.assessRisk(
      dto.userId,
      dto.walletAddress,
      dto.amount,
      dto.chain,
    );

    const request = this.withdrawalRepo.create({
      ...dto,
      riskScore: risk.score,
      isNewAddress: risk.isNewAddress,
      status: WithdrawalStatus.PENDING,
    });

    const saved = await this.withdrawalRepo.save(request);

    // Auto-approve if below threshold and low risk score
    const isEligibleForAutoApproval =
      dto.amount < this.autoApproveThreshold && risk.score < 30;

    if (isEligibleForAutoApproval) {
      return this.autoApprove(saved);
    }

    this.logger.log(
      `Withdrawal request created: id=${saved.id} amount=${saved.amount} ` +
        `status=PENDING riskScore=${risk.score} autoThreshold=${this.autoApproveThreshold}`,
    );

    return saved;
  }

  private async autoApprove(request: WithdrawalRequest): Promise<WithdrawalRequest> {
    const { jobId } = await this.blockchainQueueService.enqueue(request);

    await this.withdrawalRepo.update(request.id, {
      status: WithdrawalStatus.QUEUED,
      autoApproved: true,
      reviewedAt: new Date(),
    });

    await this.auditLogService.log({
      withdrawalRequestId: request.id,
      action: AuditAction.AUTO_APPROVED,
      metadata: {
        amount: request.amount,
        threshold: this.autoApproveThreshold,
        riskScore: request.riskScore,
        jobId,
      },
    });

    await this.notificationService.notifyUser({
      userId: request.userId,
      username: request.username,
      type: 'WITHDRAWAL_QUEUED',
      amount: request.amount,
      chain: request.chain,
      walletAddress: request.walletAddress,
    });

    this.logger.log(`Auto-approved withdrawal: id=${request.id} amount=${request.amount}`);

    return this.withdrawalRepo.findOne({ where: { id: request.id } });
  }

  /**
   * Lists pending withdrawal requests for admin review.
   */
  async listPendingRequests(filters: WithdrawalRequestFilterDto): Promise<{
    data: WithdrawalRequest[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { status = 'pending', userId, chain, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const qb = this.withdrawalRepo
      .createQueryBuilder('wr')
      .where('wr.status = :status', { status })
      .orderBy('wr.requestedAt', 'ASC'); // oldest first for fairness

    if (userId) {
      qb.andWhere('wr.userId = :userId', { userId });
    }

    if (chain) {
      qb.andWhere('wr.chain = :chain', { chain });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Admin approves a withdrawal request.
   */
  async approveRequest(
    requestId: string,
    admin: AdminUser,
  ): Promise<WithdrawalRequest> {
    const request = await this.findPendingOrThrow(requestId);

    const { jobId } = await this.blockchainQueueService.enqueue(request);

    await this.withdrawalRepo.update(requestId, {
      status: WithdrawalStatus.QUEUED,
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    });

    await this.auditLogService.log({
      withdrawalRequestId: requestId,
      adminId: admin.id,
      adminUsername: admin.username,
      action: AuditAction.APPROVED,
      metadata: {
        amount: request.amount,
        chain: request.chain,
        walletAddress: request.walletAddress,
        riskScore: request.riskScore,
        jobId,
      },
      ipAddress: admin.ipAddress,
    });

    await this.notificationService.notifyUser({
      userId: request.userId,
      username: request.username,
      type: 'WITHDRAWAL_APPROVED',
      amount: request.amount,
      chain: request.chain,
      walletAddress: request.walletAddress,
    });

    this.logger.log(
      `Withdrawal APPROVED: id=${requestId} by admin=${admin.username}`,
    );

    return this.withdrawalRepo.findOne({ where: { id: requestId } });
  }

  /**
   * Admin rejects a withdrawal request.
   */
  async rejectRequest(
    requestId: string,
    dto: RejectWithdrawalDto,
    admin: AdminUser,
  ): Promise<WithdrawalRequest> {
    const request = await this.findPendingOrThrow(requestId);

    await this.withdrawalRepo.update(requestId, {
      status: WithdrawalStatus.REJECTED,
      rejectionReason: dto.reason,
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    });

    await this.auditLogService.log({
      withdrawalRequestId: requestId,
      adminId: admin.id,
      adminUsername: admin.username,
      action: AuditAction.REJECTED,
      reason: dto.reason,
      metadata: {
        amount: request.amount,
        chain: request.chain,
        walletAddress: request.walletAddress,
        riskScore: request.riskScore,
      },
      ipAddress: admin.ipAddress,
    });

    await this.notificationService.notifyUser({
      userId: request.userId,
      username: request.username,
      type: 'WITHDRAWAL_REJECTED',
      amount: request.amount,
      chain: request.chain,
      walletAddress: request.walletAddress,
      reason: dto.reason,
    });

    this.logger.log(
      `Withdrawal REJECTED: id=${requestId} by admin=${admin.username} reason="${dto.reason}"`,
    );

    return this.withdrawalRepo.findOne({ where: { id: requestId } });
  }

  async getRequestById(requestId: string): Promise<WithdrawalRequest> {
    const request = await this.withdrawalRepo.findOne({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException(`Withdrawal request ${requestId} not found`);
    }
    return request;
  }

  async getAuditLogs(requestId: string) {
    await this.getRequestById(requestId); // validate existence
    return this.auditLogService.findByWithdrawalId(requestId);
  }

  private async findPendingOrThrow(requestId: string): Promise<WithdrawalRequest> {
    const request = await this.withdrawalRepo.findOne({ where: { id: requestId } });

    if (!request) {
      throw new NotFoundException(`Withdrawal request ${requestId} not found`);
    }

    if (request.status !== WithdrawalStatus.PENDING) {
      throw new ConflictException(
        `Withdrawal request is already ${request.status}. Only PENDING requests can be reviewed.`,
      );
    }

    return request;
  }
}
