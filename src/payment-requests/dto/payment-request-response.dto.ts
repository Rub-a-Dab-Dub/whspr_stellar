import { ApiProperty } from '@nestjs/swagger';
import { PaymentRequestStatus } from '../entities/payment-request.entity';

export class PaymentRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  requesterId!: string;

  @ApiProperty()
  requesterUsername?: string;

  @ApiProperty()
  payerId!: string;

  @ApiProperty()
  payerUsername?: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  asset!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  note?: string;

  @ApiProperty({ enum: PaymentRequestStatus })
  status!: PaymentRequestStatus;

  @ApiProperty()
  expiresAt?: Date;

  @ApiProperty()
  timeRemainingMs?: number; // calculated for PENDING

  @ApiProperty()
  paidAt?: Date;

  @ApiProperty()
  createdAt!: Date;
}

export class PaymentRequestsListResponseDto {
  @ApiProperty({ type: [PaymentRequestResponseDto] })
  data!: PaymentRequestResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  nextCursor?: string;
}
