import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../cache.service';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
} from '../decorators/cache-key.decorator';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name);

  constructor(
    private cacheService: CacheService,
    private reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only cache GET requests
    if (method !== 'GET') {
      return next.handle();
    }

    // Get custom cache key from decorator or use URL as default
    const customKey = this.reflector.get<string>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );
    const cacheKey = customKey || `http:${request.url}`;

    // Get custom TTL from decorator
    const ttl = this.reflector.get<number>(
      CACHE_TTL_METADATA,
      context.getHandler(),
    );

    // Try to get cached response
    const cachedResponse = await this.cacheService.get(cacheKey);
    if (cachedResponse) {
      this.logger.debug(`Returning cached response for: ${cacheKey}`);
      return of(cachedResponse);
    }

    // If not cached, execute the handler and cache the result
    return next.handle().pipe(
      tap(async (response) => {
        await this.cacheService.set(cacheKey, response, ttl);
        this.logger.debug(`Cached response for: ${cacheKey}`);
      }),
    );
  }
}
