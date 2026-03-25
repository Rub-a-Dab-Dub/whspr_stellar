import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminReportsGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id as string | undefined;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const configured = this.configService.get<string>('ADMIN_USER_IDS', '');
    if (!configured.trim()) {
      return true;
    }

    const adminIds = configured
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!adminIds.includes(userId)) {
      throw new UnauthorizedException('Admin access required');
    }

    return true;
  }
}
