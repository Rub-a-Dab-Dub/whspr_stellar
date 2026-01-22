import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';

/**
 * Decorator to set a custom cache key for a route handler
 * @param key Custom cache key
 */
export const CacheKey = (key: string) => SetMetadata(CACHE_KEY_METADATA, key);

/**
 * Decorator to set a custom TTL (in seconds) for a route handler
 * @param ttl Time to live in seconds
 */
export const CacheTTL = (ttl: number) => SetMetadata(CACHE_TTL_METADATA, ttl);
