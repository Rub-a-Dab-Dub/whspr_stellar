import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserTier } from '../../../users/entities/user.entity';

@Injectable()
export class GoldBlackTierGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!['gold', 'black'].includes(user.tier)) {
      throw new ForbiddenException('Gold or Black tier required for bulk payments');
    }

    return true;
  }
}

