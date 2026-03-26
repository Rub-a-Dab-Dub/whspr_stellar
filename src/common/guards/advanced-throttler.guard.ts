import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class AdvancedThrottlerGuard extends ThrottlerGuard {
  protected readonly logger = new Logger(AdvancedThrottlerGuard.name);

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user;
    const ip = req.ip;
    const method = req.method;
    const path = req.route?.path || req.url;

    // Tracker format: {IP/UserID}:{Method}:{Path}
    // This allows limiting per user/IP AND per endpoint.
    const identifier = user ? `user:${user.id}` : `ip:${ip}`;
    return `${identifier}:${method}:${path}`;
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const ip = req.ip;
    const path = req.url;

    this.logger.warn(
      `Rate limit exceeded for ${user ? `user ${user.id}` : `IP ${ip}`} on ${path}`,
    );
    throw new ThrottlerException('Too many requests. Please try again later.');
  }
}
