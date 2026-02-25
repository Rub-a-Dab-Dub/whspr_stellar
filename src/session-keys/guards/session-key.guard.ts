import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SessionKeyService } from '../session-keys.service';
import { SessionKeyScope } from '../entities/session-key.entity';

/**
 * Metadata key used to annotate which scope a route requires.
 * Usage: @RequiresSessionKeyScope(SessionKeyScope.TIP)
 */
export const SESSION_KEY_SCOPE_KEY = 'sessionKeyScope';

/**
 * Guard that validates an `x-session-key` header against the active session
 * key registry whenever a route requires paymaster-submitted transactions.
 *
 * If the header is absent the request falls through (user signed normally).
 * If the header IS present it MUST pass all validation checks.
 *
 * Attach required scope via @RequiresSessionKeyScope() metadata.
 */
@Injectable()
export class SessionKeyGuard implements CanActivate {
  constructor(
    private readonly sessionKeyService: SessionKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { sessionKey?: unknown }>();
    const publicKey = request.headers['x-session-key'] as string | undefined;

    // No session key header → allow through (user is signing themselves)
    if (!publicKey) return true;

    // Resolve required scope from route metadata
    const scope = this.reflector.getAllAndOverride<SessionKeyScope>(
      SESSION_KEY_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!scope) {
      throw new BadRequestException(
        'Route does not declare a session key scope. ' +
          'Remove x-session-key header or contact the API maintainer.',
      );
    }

    // Extract optional amount from request body for spend limit checking
    const body = request.body as Record<string, unknown> | undefined;
    const amount = body?.amount !== undefined ? String(body.amount) : undefined;

    const { sessionKey } = await this.sessionKeyService.validate(publicKey, {
      scope,
      amount,
    });

    // Attach to request for downstream use (e.g. recording spend)
    request.sessionKey = sessionKey;

    return true;
  }
}
