import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';
import { UserRole } from '../user/entities/user.entity';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  private readonly globalUserLimit: number;
  private readonly globalUserWindowMs: number;
  private readonly globalIpLimit: number;
  private readonly globalIpWindowMs: number;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: any,
  ) {
    this.globalUserLimit = this.configService.get<number>('RATE_LIMIT_USER', 100);
    this.globalUserWindowMs = this.configService.get<number>('RATE_LIMIT_USER_WINDOW_MS', 60000);
    this.globalIpLimit = this.configService.get<number>('RATE_LIMIT_IP', 30);
    this.globalIpWindowMs = this.configService.get<number>('RATE_LIMIT_IP_WINDOW_MS', 60000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Bypass for ADMIN role
    if (user?.role === UserRole.ADMIN) return true;

    // Check per-route decorator config
    const routeConfig = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (user?.sub) {
      // Authenticated user rate limit
      const limit = routeConfig?.limit ?? this.globalUserLimit;
      const windowMs = routeConfig?.windowMs ?? this.globalUserWindowMs;
      await this.checkLimit(`rl:user:${user.sub}`, limit, windowMs, request);
    } else {
      // Unauthenticated IP-based rate limit
      const ip = request.ip || request.connection?.remoteAddress || 'unknown';
      const limit = routeConfig?.limit ?? this.globalIpLimit;
      const windowMs = routeConfig?.windowMs ?? this.globalIpWindowMs;
      await this.checkLimit(`rl:ip:${ip}`, limit, windowMs, request);
    }

    return true;
  }

  private async checkLimit(
    key: string,
    limit: number,
    windowMs: number,
    request: any,
  ): Promise<void> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Sliding window using sorted list stored as JSON in cache
    let entries: number[] = (await this.cacheManager.get(key)) || [];
    // Remove expired entries
    entries = entries.filter((ts: number) => ts > windowStart);

    const remaining = Math.max(0, limit - entries.length);
    const resetTime = entries.length > 0 ? Math.ceil((entries[0] + windowMs) / 1000) : Math.ceil((now + windowMs) / 1000);

    // Set rate limit headers
    request.res?.setHeader('X-RateLimit-Limit', limit);
    request.res?.setHeader('X-RateLimit-Remaining', remaining);
    request.res?.setHeader('X-RateLimit-Reset', resetTime);

    if (entries.length >= limit) {
      const retryAfter = Math.ceil((entries[0] + windowMs - now) / 1000);
      request.res?.setHeader('Retry-After', retryAfter);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entries.push(now);
    const ttlSeconds = Math.ceil(windowMs / 1000);
    await this.cacheManager.set(key, entries, ttlSeconds * 1000);
  }
}
