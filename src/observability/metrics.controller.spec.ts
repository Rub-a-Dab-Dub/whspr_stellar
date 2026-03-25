import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  it('returns metrics payload', async () => {
    const metricsService = {
      getMetrics: jest.fn().mockResolvedValue('metric 1'),
    } as unknown as MetricsService;

    const controller = new MetricsController(metricsService);
    await expect(controller.getMetrics()).resolves.toBe('metric 1');
  });
});
