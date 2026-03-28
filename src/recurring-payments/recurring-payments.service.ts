import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  RecurringPayment,
  RecurringPaymentStatus,
  PaymentFrequency,
} from './entities/recurring-payment.entity';
import { RecurringPaymentRun, RunStatus } from './entities/recurring-payment-run.entity';
import { CreateRecurringPaymentDto, RecurringPaymentDto, RecurringPaymentRunDto } from './dto/recurring-payment.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { RedlockService } from '../cache/redlock.service';
import { InAppNotificationType } from '../notifications/entities/notification.entity';

const MAX_CONSECUTIVE_FAILURES = 3;
const PROCESS_LOCK_TTL = 55_000; // 55s — slightly under the 60s cron window

@Injectable()
export class RecurringPaymentsService {
  private readonly logger = new Logger(RecurringPaymentsService.name);

  constructor(
    @InjectRepository(RecurringPayment)
    private readonly rpRepo: Repository<RecurringPayment>,
    @InjectRepository(RecurringPaymentRun)
    private readonly runRepo: Repository<RecurringPaymentRun>,
    private readonly notifications: NotificationsService,
    private readonly redlock: RedlockService,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async createRecurring(
    senderId: string,
    dto: CreateRecurringPaymentDto,
  ): Promise<RecurringPaymentDto> {
    const nextRunAt = new Date(dto.startAt);
    if (isNaN(nextRunAt.getTime())) throw new BadRequestException('Invalid startAt date');

    const rp = this.rpRepo.create({
      senderId,
      recipientAddress: dto.recipientAddress,
      tokenId: dto.tokenId ?? null,
      amount: dto.amount,
      frequency: dto.frequency,
      nextRunAt,
      maxRuns: dto.maxRuns ?? null,
      status: RecurringPaymentStatus.ACTIVE,
    });

    await this.rpRepo.save(rp);
    return this.toDto(rp);
  }

  async getRecurringPayments(senderId: string): Promise<RecurringPaymentDto[]> {
    const rps = await this.rpRepo.find({
      where: { senderId },
      order: { createdAt: 'DESC' },
    });
    return rps.map((r) => this.toDto(r));
  }

  async pauseRecurring(senderId: string, id: string): Promise<RecurringPaymentDto> {
    const rp = await this.findOwned(senderId, id);
    if (rp.status !== RecurringPaymentStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE payments can be paused');
    }
    rp.status = RecurringPaymentStatus.PAUSED;
    await this.rpRepo.save(rp);
    return this.toDto(rp);
  }

  async resumeRecurring(senderId: string, id: string): Promise<RecurringPaymentDto> {
    const rp = await this.findOwned(senderId, id);
    if (rp.status !== RecurringPaymentStatus.PAUSED) {
      throw new BadRequestException('Only PAUSED payments can be resumed');
    }
    rp.status = RecurringPaymentStatus.ACTIVE;
    await this.rpRepo.save(rp);
    return this.toDto(rp);
  }

  async cancelRecurring(senderId: string, id: string): Promise<void> {
    const rp = await this.findOwned(senderId, id);
    if (rp.status === RecurringPaymentStatus.CANCELLED) {
      throw new BadRequestException('Payment is already cancelled');
    }
    rp.status = RecurringPaymentStatus.CANCELLED;
    await this.rpRepo.save(rp);
  }

  async getRunHistory(senderId: string, id: string): Promise<RecurringPaymentRunDto[]> {
    const rp = await this.findOwned(senderId, id);
    const runs = await this.runRepo.find({
      where: { recurringPaymentId: rp.id },
      order: { executedAt: 'DESC' },
    });
    return runs.map((r) => this.toRunDto(r));
  }

  // ── Cron processor ───────────────────────────────────────────────────────────

  async processDue(): Promise<void> {
    await this.redlock.withLock('lock:recurring-payments:process', PROCESS_LOCK_TTL, async () => {
      const now = new Date();
      const due = await this.rpRepo.find({
        where: {
          status: RecurringPaymentStatus.ACTIVE,
          nextRunAt: LessThanOrEqual(now),
        },
      });

      this.logger.log(`Processing ${due.length} due recurring payments`);
      await Promise.allSettled(due.map((rp) => this.executePayment(rp)));
    });
  }

  // ── 24h pre-run notifier ─────────────────────────────────────────────────────

  async notifyUpcoming(): Promise<void> {
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const upcoming = await this.rpRepo
      .createQueryBuilder('rp')
      .where('rp.status = :status', { status: RecurringPaymentStatus.ACTIVE })
      .andWhere('rp.nextRunAt <= :in24h', { in24h })
      .andWhere('rp.nextRunAt > :now', { now: new Date() })
      .getMany();

    await Promise.allSettled(
      upcoming.map((rp) =>
        this.notifications.createNotification({
          userId: rp.senderId,
          type: InAppNotificationType.SYSTEM,
          title: 'Upcoming Recurring Payment',
          body: `Your recurring payment of ${rp.amount} is scheduled in less than 24 hours.`,
          data: { recurringPaymentId: rp.id },
        }),
      ),
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async executePayment(rp: RecurringPayment): Promise<void> {
    try {
      // Simulate on-chain transfer — replace with real Soroban call
      const txHash = await this.submitTransfer(rp);

      rp.totalRuns += 1;
      rp.lastRunAt = new Date();
      rp.consecutiveFailures = 0;
      rp.nextRunAt = this.calcNextRun(rp.nextRunAt, rp.frequency);

      if (rp.maxRuns !== null && rp.totalRuns >= rp.maxRuns) {
        rp.status = RecurringPaymentStatus.COMPLETED;
      }

      await this.rpRepo.save(rp);
      await this.runRepo.save(
        this.runRepo.create({
          recurringPaymentId: rp.id,
          txHash,
          status: RunStatus.SUCCESS,
          amount: rp.amount,
        }),
      );
    } catch (err) {
      const msg = (err as Error).message;
      rp.consecutiveFailures += 1;

      if (rp.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        rp.status = RecurringPaymentStatus.CANCELLED;
        await this.rpRepo.save(rp);
        await this.notifyAutoCancelled(rp);
      } else {
        await this.rpRepo.save(rp);
      }

      await this.runRepo.save(
        this.runRepo.create({
          recurringPaymentId: rp.id,
          txHash: null,
          status: RunStatus.FAILED,
          amount: rp.amount,
          errorMessage: msg,
        }),
      );

      this.logger.warn(`Recurring payment ${rp.id} failed: ${msg}`);
    }
  }

  private async submitTransfer(rp: RecurringPayment): Promise<string> {
    // Placeholder — wire up SorobanService / blockchain service here
    void rp;
    return `mock-tx-${Date.now()}`;
  }

  private async notifyAutoCancelled(rp: RecurringPayment): Promise<void> {
    await this.notifications.createNotification({
      userId: rp.senderId,
      type: InAppNotificationType.SYSTEM,
      title: 'Recurring Payment Cancelled',
      body: `Your recurring payment of ${rp.amount} was auto-cancelled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures.`,
      data: { recurringPaymentId: rp.id },
    });
  }

  private calcNextRun(from: Date, frequency: PaymentFrequency): Date {
    const next = new Date(from);
    switch (frequency) {
      case PaymentFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case PaymentFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case PaymentFrequency.BIWEEKLY:
        next.setDate(next.getDate() + 14);
        break;
      case PaymentFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }

  private async findOwned(senderId: string, id: string): Promise<RecurringPayment> {
    const rp = await this.rpRepo.findOne({ where: { id } });
    if (!rp) throw new NotFoundException(`Recurring payment ${id} not found`);
    if (rp.senderId !== senderId) throw new ForbiddenException('Access denied');
    return rp;
  }

  private toDto(rp: RecurringPayment): RecurringPaymentDto {
    return {
      id: rp.id,
      senderId: rp.senderId,
      recipientAddress: rp.recipientAddress,
      tokenId: rp.tokenId,
      amount: rp.amount,
      frequency: rp.frequency,
      nextRunAt: rp.nextRunAt,
      lastRunAt: rp.lastRunAt,
      totalRuns: rp.totalRuns,
      maxRuns: rp.maxRuns,
      status: rp.status,
      createdAt: rp.createdAt,
    };
  }

  private toRunDto(r: RecurringPaymentRun): RecurringPaymentRunDto {
    return {
      id: r.id,
      recurringPaymentId: r.recurringPaymentId,
      txHash: r.txHash,
      status: r.status,
      amount: r.amount,
      errorMessage: r.errorMessage,
      executedAt: r.executedAt,
    };
  }
}
