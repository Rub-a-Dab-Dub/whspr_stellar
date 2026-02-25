import { CacheService } from '../cache.service';

export function Cacheable(keyPrefix: string, ttl?: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService: CacheService = this.cacheService;
      if (!cacheService) {
        return originalMethod.apply(this, args);
      }

      const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;
      const cached = await cacheService.get(cacheKey);

      if (cached !== null) {
        return cached;
      }

      const result = await originalMethod.apply(this, args);
      await cacheService.set(cacheKey, result, ttl);
      return result;
    };

    return descriptor;
  };
}
