import { Throttle, SkipThrottle } from '@nestjs/throttler';

export const RateLimit = (limit: number, ttl: number) => Throttle({ default: { limit, ttl } });
export const SkipRateLimit = () => SkipThrottle();
