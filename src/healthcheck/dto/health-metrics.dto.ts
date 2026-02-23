// src/health/dto/health-metrics.dto.ts
export class HealthMetricsDto {
  timestamp: string;
  status: 'ok' | 'error' | 'shutting_down';
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  services: Record<string, any>;
  errors: Record<string, any>;
}
