import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserResponseDto } from '../../users/dto/user-response.dto';

@Injectable()
export class AdminAnalyticsGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: UserResponseDto }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Admin analytics access requires authentication');
    }

    const allowedUserIds = this.readCsv('ADMIN_USER_IDS');
    const allowedWallets = this.readCsv('ADMIN_WALLET_ADDRESSES');
    const normalizedWallet = user.walletAddress.toLowerCase();

    if (allowedUserIds.includes(user.id) || allowedWallets.includes(normalizedWallet)) {
      return true;
    }

    throw new ForbiddenException('Admin analytics access is not allowed for this user');
  }

  private readCsv(key: string): string[] {
    const value = this.configService.get<string>(key, '');
    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
}
