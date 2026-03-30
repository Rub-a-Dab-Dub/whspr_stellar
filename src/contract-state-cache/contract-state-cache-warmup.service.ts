import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractStateCacheService } from './contract-state-cache.service';

@Injectable()
export class ContractStateCacheWarmupService implements OnModuleInit {
  private readonly logger = new Logger(ContractStateCacheWarmupService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly contractStateCache: ContractStateCacheService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const raw = this.config.get<string>('CONTRACT_CACHE_WARM_ON_STARTUP', 'true').toLowerCase();
    if (raw !== 'true' && raw !== '1' && raw !== 'yes') {
      return;
    }
    void this.contractStateCache
      .warmCache({ userLimit: 1000, maxDurationMs: 60_000 })
      .then((r) =>
        this.logger.log(
          `Soroban contract cache warm-up finished: warmed=${r.warmed} skipped=${r.skipped} ` +
            `durationMs=${r.durationMs} timedOut=${r.timedOut}`,
        ),
      )
      .catch((e: Error) => this.logger.warn(`Soroban contract cache warm-up failed: ${e.message}`));
  }
}
