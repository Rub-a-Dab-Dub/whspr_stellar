import { Injectable } from '@nestjs/common';
import { DataSource, In, LessThan, MoreThan, Repository, Not } from 'typeorm';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { PaymentRecord, PaymentStatus } from './entities/payment-record.entity';
import { PaginatedPaymentHistoryDto } from './dto/paginated-payment-history.dto';

interface PaginatedResult<T> {
  data: T[];
  total: number;
}

@Injectable()
export class PaymentsRepository {
  private subscriptionRepo: Repository<Subscription>;
  private paymentRepo: Repository<PaymentRecord>;

  constructor(private dataSource: DataSource) {
    this.subscriptionRepo = dataSource.getRepository(Subscription);
    this.paymentRepo = dataSource.getRepository(PaymentRecord);
  }

  async findUserActiveSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async findUserSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findExpiredSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: {
        status: Not(In([SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED])),
        currentPeriodEnd: LessThan(new Date()),
      },
    });
  }

  async createSubscription(sub: Partial<Subscription>): Promise<Subscription> {
    const subscription = this.subscriptionRepo.create(sub);
    return this.subscriptionRepo.save(subscription);
  }

  async updateSubscription(subId: string, updates: Partial<Subscription>): Promise<Subscription> {
    await this.subscriptionRepo.update(subId, updates);
    return this.subscriptionRepo.findOneOrFail({ where: { id: subId } });
  }

  async getUserPaymentHistory(
    userId: string,
    dto: PaginatedPaymentHistoryDto,
  ): Promise<PaginatedResult<PaymentRecord>> {
    const { page = 1, limit = 20, status } = dto;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) where.status = status;

    const [data, total] = await this.paymentRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total } as PaginatedResult<PaymentRecord> & { page: number; limit: number };
  }

  async createPaymentRecord(payment: Partial<PaymentRecord>): Promise<PaymentRecord> {
    const record = this.paymentRepo.create(payment);
    return this.paymentRepo.save(record);
  }

  async updatePaymentRecord(recordId: string, updates: Partial<PaymentRecord>): Promise<PaymentRecord> {
    await this.paymentRepo.update(recordId, updates);
    return this.paymentRepo.findOneOrFail({ where: { id: recordId } });
  }

  async findPaymentByProviderId(providerPaymentId: string): Promise<PaymentRecord | null> {
    return this.paymentRepo.findOne({ where: { providerPaymentId } });
  }
}

