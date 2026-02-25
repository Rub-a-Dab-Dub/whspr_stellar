import { Factory } from 'fishery';
import { Payment, PaymentType, PaymentStatus } from '../../src/payments/entities/payment.entity';

export const PaymentFactory = Factory.define<Payment>(({ sequence, associations }) => ({
  id: `payment-${sequence}`,
  sender: associations.sender ?? null,
  senderId: associations.senderId ?? `user-${sequence}`,
  recipient: associations.recipient ?? null,
  recipientId: associations.recipientId ?? `user-${sequence + 1}`,
  recipientWalletAddress: associations.recipientWalletAddress ?? `G${(sequence + 1).toString().padStart(55, '0')}`,
  amount: associations.amount ?? '10.00000000',
  tokenAddress: associations.tokenAddress ?? null,
  transactionHash: associations.transactionHash ?? `tx-${sequence}`,
  type: associations.type ?? PaymentType.P2P,
  status: associations.status ?? PaymentStatus.COMPLETED,
  failureReason: associations.failureReason ?? null,
  createdAt: associations.createdAt ?? new Date(),
  updatedAt: associations.updatedAt ?? new Date(),
  completedAt: associations.completedAt ?? new Date(),
}));

// Factory variants for different payment scenarios
export const PendingPaymentFactory = PaymentFactory.params({
  status: PaymentStatus.PENDING,
  completedAt: null,
  transactionHash: null,
});

export const FailedPaymentFactory = PaymentFactory.params({
  status: PaymentStatus.FAILED,
  failureReason: 'Insufficient funds',
  completedAt: null,
});

export const TipPaymentFactory = PaymentFactory.params({
  type: PaymentType.TIP,
  amount: '5.00000000',
});
