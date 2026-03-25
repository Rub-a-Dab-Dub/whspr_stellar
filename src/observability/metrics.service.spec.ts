import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('records request duration and exposes metrics output', async () => {
    service.observeRequestDuration('GET', '/health/live', 200, 15);
    const metrics = await service.getMetrics();
    expect(metrics).toContain('http_request_duration_ms');
  });

  it('tracks queue depth and websocket connections', async () => {
    service.setQueueDepth('webhook-deliveries', 7);
    service.setWsConnections(3);
    const metrics = await service.getMetrics();
    expect(metrics).toContain('queue_depth');
    expect(metrics).toContain('ws_connections');
  });

  it('tracks cache hit rate', async () => {
    service.recordCacheHit();
    service.recordCacheMiss();
    const metrics = await service.getMetrics();
    expect(metrics).toContain('cache_hit_rate');
  });
});
