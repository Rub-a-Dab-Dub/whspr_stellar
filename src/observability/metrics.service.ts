import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly requestDurationHistogram = new Histogram({
    name: 'http_request_duration_ms',
    help: 'Request duration in milliseconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [this.registry],
  });

  private readonly queueDepthGauge = new Gauge({
    name: 'queue_depth',
    help: 'Current queue depth by queue',
    labelNames: ['queue'],
    registers: [this.registry],
  });

  private readonly wsConnectionsGauge = new Gauge({
    name: 'ws_connections',
    help: 'Current websocket connections',
    registers: [this.registry],
  });

  private readonly cacheHitRateGauge = new Gauge({
    name: 'cache_hit_rate',
    help: 'Cache hit rate between 0 and 1',
    registers: [this.registry],
  });

  private readonly cacheHitCounter = new Counter({
    name: 'cache_hits_total',
    help: 'Total cache hits',
    registers: [this.registry],
  });

  private readonly cacheMissCounter = new Counter({
    name: 'cache_misses_total',
    help: 'Total cache misses',
    registers: [this.registry],
  });

  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  observeRequestDuration(method: string, route: string, statusCode: number, durationMs: number): void {
    this.requestDurationHistogram
      .labels(method.toUpperCase(), route, String(statusCode))
      .observe(durationMs);
  }

  setQueueDepth(queue: string, depth: number): void {
    this.queueDepthGauge.labels(queue).set(depth);
  }

  setWsConnections(count: number): void {
    this.wsConnectionsGauge.set(count);
  }

  recordCacheHit(): void {
    this.cacheHitCounter.inc();
    this.cacheHits += 1;
    this.updateCacheHitRate();
  }

  recordCacheMiss(): void {
    this.cacheMissCounter.inc();
    this.cacheMisses += 1;
    this.updateCacheHitRate();
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  private updateCacheHitRate(): void {
    const total = this.cacheHits + this.cacheMisses;
    this.cacheHitRateGauge.set(total === 0 ? 0 : this.cacheHits / total);
  }
}
