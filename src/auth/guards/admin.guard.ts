import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Admin access requires authentication');
    }

    const allowedUserIds = this.readCsv('ADMIN_USER_IDS');
    const allowedWallets = this.readCsv('ADMIN_WALLET_ADDRESSES');

    const userId = user.id ? user.id.toLowerCase() : '';
    const walletAddress = user.walletAddress ? user.walletAddress.toLowerCase() : '';

    if (
      (userId && allowedUserIds.includes(userId)) ||
      (walletAddress && allowedWallets.includes(walletAddress))
    ) {
      return true;
    }

    throw new ForbiddenException('Admin access is not allowed for this user');
  }

  private readCsv(key: string): string[] {
    const value = this.configService.get<string>(key, '');
    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
}
