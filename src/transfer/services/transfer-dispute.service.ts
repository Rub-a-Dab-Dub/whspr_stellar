import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TransferDispute,
  DisputeStatus,
  DisputeReason,
} from '../entities/transfer-dispute.entity';
import { Transfer, TransferStatus } from '../entities/transfer.entity';
import { CreateDisputeDto } from '../dto/create-dispute.dto';

@Injectable()
export class TransferDisputeService {
  private readonly logger = new Logger(TransferDisputeService.name);

  constructor(
    @InjectRepository(TransferDispute)
    private readonly disputeRepository: Repository<TransferDispute>,
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
  ) {}

  async createDispute(
    transferId: string,
    userId: string,
    dto: CreateDisputeDto,
  ): Promise<TransferDispute> {
    const transfer = await this.transferRepository.findOne({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    // Only sender or recipient can create a dispute
    if (transfer.senderId !== userId && transfer.recipientId !== userId) {
      throw new ForbiddenException('You are not authorized to dispute this transfer');
    }

    // Can only dispute completed transfers
    if (transfer.status !== TransferStatus.COMPLETED) {
      throw new BadRequestException('Can only dispute completed transfers');
    }

    // Check if dispute already exists
    const existingDispute = await this.disputeRepository.findOne({
      where: { transferId, initiatorId: userId },
    });

    if (existingDispute) {
      throw new BadRequestException('You have already created a dispute for this transfer');
    }

    const dispute = this.disputeRepository.create({
      transferId,
      initiatorId: userId,
      reason: dto.reason,
      description: dto.description,
      evidence: dto.evidence || [],
      status: DisputeStatus.OPEN,
    });

    return await this.disputeRepository.save(dispute);
  }

  async getDisputes(userId: string): Promise<TransferDispute[]> {
    return await this.disputeRepository.find({
      where: { initiatorId: userId },
      relations: ['transfer'],
      order: { createdAt: 'DESC' },
    });
  }

  async getDisputeById(disputeId: string, userId: string): Promise<TransferDispute> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      relations: ['transfer', 'initiator'],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Check authorization
    if (dispute.initiatorId !== userId && dispute.transfer.senderId !== userId && dispute.transfer.recipientId !== userId) {
      throw new ForbiddenException('You are not authorized to view this dispute');
    }

    return dispute;
  }

  async updateDisputeStatus(
    disputeId: string,
    adminId: string,
    status: DisputeStatus,
    resolution?: string,
  ): Promise<TransferDispute> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.CLOSED) {
      throw new BadRequestException('Cannot update a resolved or closed dispute');
    }

    dispute.status = status;
    if (resolution) {
      dispute.resolution = resolution;
    }

    if (status === DisputeStatus.RESOLVED || status === DisputeStatus.REJECTED) {
      dispute.resolvedBy = adminId;
      dispute.resolvedAt = new Date();
    }

    return await this.disputeRepository.save(dispute);
  }

  async addEvidence(
    disputeId: string,
    userId: string,
    evidence: string[],
  ): Promise<TransferDispute> {
    const dispute = await this.getDisputeById(disputeId, userId);

    if (dispute.initiatorId !== userId) {
      throw new ForbiddenException('Only the dispute initiator can add evidence');
    }

    if (dispute.status !== DisputeStatus.OPEN && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new BadRequestException('Cannot add evidence to a resolved dispute');
    }

    dispute.evidence = [...(dispute.evidence || []), ...evidence];

    return await this.disputeRepository.save(dispute);
  }

  async getDisputeStatistics(userId?: string): Promise<any> {
    const queryBuilder = this.disputeRepository.createQueryBuilder('dispute');

    if (userId) {
      queryBuilder.where('dispute.initiatorId = :userId', { userId });
    }

    const total = await queryBuilder.getCount();

    const byStatus = await queryBuilder
      .select('dispute.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('dispute.status')
      .getRawMany();

    const byReason = await queryBuilder
      .select('dispute.reason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .groupBy('dispute.reason')
      .getRawMany();

    return {
      total,
      byStatus,
      byReason,
    };
  }
}
