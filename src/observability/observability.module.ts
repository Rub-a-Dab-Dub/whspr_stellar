import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { RequestMetricsInterceptor } from './request-metrics.interceptor';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, RequestMetricsInterceptor],
  exports: [MetricsService, RequestMetricsInterceptor],
})
export class ObservabilityModule {}
