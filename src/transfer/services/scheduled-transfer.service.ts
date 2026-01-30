import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ScheduledTransfer,
  ScheduledTransferStatus,
  RecurrenceFrequency,
} from '../entities/scheduled-transfer.entity';
import { CreateScheduledTransferDto } from '../dto/create-scheduled-transfer.dto';
import { TransferService } from '../transfer.service';
import { TransferValidationService } from './transfer-validation.service';

@Injectable()
export class ScheduledTransferService {
  private readonly logger = new Logger(ScheduledTransferService.name);

  constructor(
    @InjectRepository(ScheduledTransfer)
    private readonly scheduledTransferRepository: Repository<ScheduledTransfer>,
    private readonly transferService: TransferService,
    private readonly validationService: TransferValidationService,
  ) {}

  async createScheduledTransfer(
    userId: string,
    dto: CreateScheduledTransferDto,
  ): Promise<ScheduledTransfer> {
    // Validate recipient
    await this.validationService.validateRecipient(dto.recipientId, userId);

    // Validate amount
    this.validationService.validateAmount(dto.amount);

    // Validate scheduled date is in the future
    if (dto.scheduledDate <= new Date()) {
      throw new BadRequestException('Scheduled date must be in the future');
    }

    // Validate recurrence settings
    if (dto.isRecurring) {
      if (!dto.recurrenceFrequency) {
        throw new BadRequestException('Recurrence frequency is required for recurring transfers');
      }

      if (dto.recurrenceEndDate && dto.recurrenceEndDate <= dto.scheduledDate) {
        throw new BadRequestException('Recurrence end date must be after scheduled date');
      }
    }

    const scheduledTransfer = this.scheduledTransferRepository.create({
      senderId: userId,
      recipientId: dto.recipientId,
      amount: dto.amount.toFixed(8),
      scheduledDate: dto.scheduledDate,
      isRecurring: dto.isRecurring || false,
      recurrenceFrequency: dto.recurrenceFrequency,
      recurrenceEndDate: dto.recurrenceEndDate,
      maxExecutions: dto.maxExecutions,
      nextExecutionDate: dto.scheduledDate,
      memo: dto.memo,
      note: dto.note,
      blockchainNetwork: dto.blockchainNetwork || 'stellar',
    });

    return await this.scheduledTransferRepository.save(scheduledTransfer);
  }

  async getScheduledTransfers(userId: string): Promise<ScheduledTransfer[]> {
    return await this.scheduledTransferRepository.find({
      where: { senderId: userId },
      order: { scheduledDate: 'ASC' },
    });
  }

  async getScheduledTransferById(
    scheduledTransferId: string,
    userId: string,
  ): Promise<ScheduledTransfer> {
    const scheduledTransfer = await this.scheduledTransferRepository.findOne({
      where: { id: scheduledTransferId, senderId: userId },
    });

    if (!scheduledTransfer) {
      throw new NotFoundException('Scheduled transfer not found');
    }

    return scheduledTransfer;
  }

  async cancelScheduledTransfer(
    scheduledTransferId: string,
    userId: string,
    reason?: string,
  ): Promise<ScheduledTransfer> {
    const scheduledTransfer = await this.getScheduledTransferById(scheduledTransferId, userId);

    if (scheduledTransfer.status !== ScheduledTransferStatus.PENDING) {
      throw new BadRequestException('Can only cancel pending scheduled transfers');
    }

    scheduledTransfer.status = ScheduledTransferStatus.CANCELLED;
    scheduledTransfer.cancelledAt = new Date();
    scheduledTransfer.cancelledBy = userId;
    scheduledTransfer.cancellationReason = reason;

    return await this.scheduledTransferRepository.save(scheduledTransfer);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledTransfers(): Promise<void> {
    const now = new Date();

    const dueTransfers = await this.scheduledTransferRepository.find({
      where: {
        status: ScheduledTransferStatus.PENDING,
        nextExecutionDate: LessThanOrEqual(now),
      },
      take: 100, // Process 100 at a time
    });

    this.logger.log(`Processing ${dueTransfers.length} scheduled transfers`);

    for (const scheduledTransfer of dueTransfers) {
      try {
        await this.executeScheduledTransfer(scheduledTransfer);
      } catch (error) {
        this.logger.error(
          `Failed to execute scheduled transfer ${scheduledTransfer.id}: ${error.message}`,
        );
      }
    }
  }

  private async executeScheduledTransfer(
    scheduledTransfer: ScheduledTransfer,
  ): Promise<void> {
    try {
      // Execute the transfer
      const transfer = await this.transferService.createTransfer(
        scheduledTransfer.senderId,
        {
          recipientId: scheduledTransfer.recipientId,
          amount: parseFloat(scheduledTransfer.amount),
          memo: scheduledTransfer.memo,
          note: scheduledTransfer.note,
          blockchainNetwork: scheduledTransfer.blockchainNetwork,
        },
      );

      scheduledTransfer.lastTransferId = transfer.id;
      scheduledTransfer.executionCount += 1;
      scheduledTransfer.executedAt = new Date();

      // Handle recurring transfers
      if (scheduledTransfer.isRecurring) {
        const shouldContinue = this.shouldContinueRecurrence(scheduledTransfer);

        if (shouldContinue) {
          scheduledTransfer.nextExecutionDate = this.calculateNextExecutionDate(
            scheduledTransfer.nextExecutionDate,
            scheduledTransfer.recurrenceFrequency,
          );
        } else {
          scheduledTransfer.status = ScheduledTransferStatus.EXECUTED;
        }
      } else {
        scheduledTransfer.status = ScheduledTransferStatus.EXECUTED;
      }

      await this.scheduledTransferRepository.save(scheduledTransfer);

      this.logger.log(`Successfully executed scheduled transfer ${scheduledTransfer.id}`);
    } catch (error) {
      scheduledTransfer.status = ScheduledTransferStatus.FAILED;
      await this.scheduledTransferRepository.save(scheduledTransfer);
      throw error;
    }
  }

  private shouldContinueRecurrence(scheduledTransfer: ScheduledTransfer): boolean {
    // Check max executions
    if (
      scheduledTransfer.maxExecutions &&
      scheduledTransfer.executionCount >= scheduledTransfer.maxExecutions
    ) {
      return false;
    }

    // Check end date
    if (scheduledTransfer.recurrenceEndDate) {
      const nextDate = this.calculateNextExecutionDate(
        scheduledTransfer.nextExecutionDate,
        scheduledTransfer.recurrenceFrequency,
      );
      if (nextDate > scheduledTransfer.recurrenceEndDate) {
        return false;
      }
    }

    return true;
  }

  private calculateNextExecutionDate(
    currentDate: Date,
    frequency: RecurrenceFrequency,
  ): Date {
    const nextDate = new Date(currentDate);

    switch (frequency) {
      case RecurrenceFrequency.DAILY:
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case RecurrenceFrequency.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case RecurrenceFrequency.BIWEEKLY:
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case RecurrenceFrequency.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case RecurrenceFrequency.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case RecurrenceFrequency.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    return nextDate;
  }
}
