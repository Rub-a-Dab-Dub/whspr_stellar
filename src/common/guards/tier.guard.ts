import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserTier } from '../../users/entities/user.entity';
import { TIER_KEY } from '../decorators/tier.decorator';

@Injectable()
export class TierGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTier = this.reflector.getAllAndOverride<UserTier>(TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredTier) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false;
    }

    const tierHierarchy: Record<UserTier, number> = {
      [UserTier.SILVER]: 1,
      [UserTier.GOLD]: 2,
      [UserTier.BLACK]: 3,
    };

    const userTierValue = tierHierarchy[user.tier as UserTier] || 0;
    const requiredTierValue = tierHierarchy[requiredTier];

    if (userTierValue < requiredTierValue) {
      throw new ForbiddenException(
        `Insufficient membership tier. Required: ${requiredTier}, Current: ${user.tier}`,
      );
    }

    return true;
  }
}
