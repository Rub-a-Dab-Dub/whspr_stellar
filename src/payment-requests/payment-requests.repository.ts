import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, Not } from 'typeorm';
import { PaymentRequest, PaymentRequestStatus } from './entities/payment-request.entity';

@Injectable()
export class PaymentRequestRepository {
  constructor(
    @InjectRepository(PaymentRequest)
    private repo: Repository<PaymentRequest>,
  ) {}

  async getRequestsForUser(userId: string, isRequester: boolean = null, limit = 50, cursor?: string): Promise<PaymentRequest[]> {
    const qb = this.repo.createQueryBuilder('pr')
      .leftJoinAndSelect('pr.requester', 'requester')
      .leftJoinAndSelect('pr.payer', 'payer')
      .leftJoinAndSelect('pr.conversation', 'conversation')
      .where(isRequester ? 'pr.requesterId = :userId' : 'pr.payerId = :userId', { userId });

    if (cursor) {
      qb.andWhere('pr.createdAt < :cursor', { cursor: new Date(cursor) });
    }

    qb.orderBy('pr.createdAt', 'DESC')
      .take(limit + 1);

    const results = await qb.getMany();

    return results.slice(0, limit);
  }

  async getPendingRequestsForPayer(payerId: string, limit = 20): Promise<PaymentRequest[]> {
    return this.repo.find({
      where: {
        payerId,
        status: PaymentRequestStatus.PENDING,
        expiresAt: Not(IsNull()),
        expiresAt: LessThan(new Date()),
      },
      relations: ['requester', 'conversation'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async expireStaleRequests(): Promise<number> {
    const expired = await this.repo.createQueryBuilder()
      .update(PaymentRequest)
      .set({ status: PaymentRequestStatus.EXPIRED })
      .where('status = :pending', { pending: PaymentRequestStatus.PENDING })
      .andWhere('expiresAt < NOW()')
      .execute();

    return expired.affected || 0;
  }
}
