import { UserTier } from '../../users/entities/user.entity';
import { SubscriptionStatus } from '../entities/subscription.entity';

export class SubscriptionResponseDto {
  id!: string;
  tier!: UserTier;
  status!: SubscriptionStatus;
  providerSubscriptionId!: string | null;
  currentPeriodStart!: Date | null;
  currentPeriodEnd!: Date | null;
  cancelledAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

