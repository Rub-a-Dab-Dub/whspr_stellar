import { CacheService } from '../cache.service';

export function CacheEvict(keyPrefix: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      const cacheService: CacheService = this.cacheService;
      if (cacheService) {
        const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;
        await cacheService.del(cacheKey);
      }

      return result;
    };

    return descriptor;
  };
}
