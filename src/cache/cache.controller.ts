import { Controller, Get } from '@nestjs/common';
import { CacheService } from './cache.service';

@Controller('metrics')
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get()
  getMetrics() {
    return this.cacheService.getMetrics();
  }
}
