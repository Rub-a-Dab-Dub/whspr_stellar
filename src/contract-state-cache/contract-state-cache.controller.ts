import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ContractStateCacheService } from './contract-state-cache.service';
import { WarmContractCacheDto } from './dto/warm-contract-cache.dto';

@Controller('admin/contract-cache')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ContractStateCacheController {
  constructor(private readonly contractStateCache: ContractStateCacheService) {}

  @Get('stats')
  async stats() {
    return this.contractStateCache.getCacheStats();
  }

  @Post('warm')
  async warm(@Body() body: WarmContractCacheDto) {
    return this.contractStateCache.warmCache({
      userLimit: body.userLimit,
      maxDurationMs: body.maxDurationMs,
    });
  }

  @Delete(':contract')
  async invalidate(@Param('contract') contract: string) {
    return this.contractStateCache.invalidate(decodeURIComponent(contract));
  }
}
