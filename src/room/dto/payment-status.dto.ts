export class PaymentStatusDto {
  paymentId: string;
  status: string;
  transactionHash: string;
  amount: string;
  platformFee: string;
  creatorAmount: string;
  accessGranted: boolean;
  accessExpiresAt?: Date;
  createdAt: Date;
}
