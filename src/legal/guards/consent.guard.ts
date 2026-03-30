import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { LegalService } from '../legal.service';

export const SKIP_CONSENT_KEY = 'skipConsent';

@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly legalService: LegalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const skipConsent = this.reflector.getAllAndOverride<boolean>(SKIP_CONSENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipConsent) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) return true; // unauthenticated — JWT guard handles that

    await this.legalService.enforceConsent(user.id);
    return true;
  }
}
