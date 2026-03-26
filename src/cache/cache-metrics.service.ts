import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';

@Injectable()
export class CacheMetricsService implements OnModuleInit {
  private hitCounter: Counter;
  private missCounter: Counter;
  private errorCounter: Counter;

  constructor(private readonly registry: Registry) {}

  onModuleInit() {
    this.hitCounter = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['key_prefix'],
      registers: [this.registry],
    });

    this.missCounter = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['key_prefix'],
      registers: [this.registry],
    });

    this.errorCounter = new Counter({
      name: 'cache_errors_total',
      help: 'Total number of cache errors (Redis unavailable, serialization, etc.)',
      labelNames: ['operation'],
      registers: [this.registry],
    });
  }

  recordHit(keyPrefix: string) {
    this.hitCounter?.inc({ key_prefix: keyPrefix });
  }

  recordMiss(keyPrefix: string) {
    this.missCounter?.inc({ key_prefix: keyPrefix });
  }

  recordError(operation: string) {
    this.errorCounter?.inc({ operation });
  }
}