import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cache.service';
import { TTL } from '../config/redis.config';

/**
 * HTTP response cache middleware for GET endpoints.
 * Skips caching for authenticated mutations and non-200 responses.
 */
@Injectable()
export class CacheMiddleware implements NestMiddleware {
  constructor(private readonly cacheService: CacheService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const key = `http:${req.originalUrl}`;
    const cached = await this.cacheService.get<string>(key);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Type', 'application/json');
      res.end(cached);
      return;
    }

    res.setHeader('X-Cache', 'MISS');

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode === 200) {
        void this.cacheService.set(key, JSON.stringify(body), TTL.SHORT);
      }
      return originalJson(body);
    };

    next();
  }
}
