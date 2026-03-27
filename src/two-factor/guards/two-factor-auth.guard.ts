import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { TwoFactorService } from '../two-factor.service';

@Injectable()
export class TwoFactorAuthGuard implements CanActivate {
  static readonly headerName = 'x-2fa-code';

  constructor(private readonly twoFactorService: TwoFactorService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { id?: string } | undefined;
    if (!user?.id) {
      return false;
    }

    const rawHeader = req.headers[TwoFactorAuthGuard.headerName];
    const headerCode = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    await this.twoFactorService.validateSensitiveActionCode(user.id, headerCode ?? '');
    return true;
  }
}
