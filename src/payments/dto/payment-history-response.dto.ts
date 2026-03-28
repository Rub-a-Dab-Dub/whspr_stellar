import { PaymentStatus } from '../entities/payment-record.entity';

export class PaymentHistoryItemDto {
  id!: string;
  amount!: string;
  currency!: string;
  status!: PaymentStatus;
  providerPaymentId!: string | null;
  paidAt!: Date | null;
  createdAt!: Date;
}

export class PaginatedPaymentHistoryDto {
  data!: PaymentHistoryItemDto[];
  total!: number;
  page!: number;
  limit!: number;
}

