import { SystemService } from './system.service';

describe('SystemService status aggregation', () => {
  const service = new SystemService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  it('returns healthy when all services are healthy', () => {
    const status = service.deriveOverallStatus({
      databaseStatus: 'healthy',
      redisStatus: 'healthy',
      queueFailedCounts: [0, 0, 0],
      chainStatuses: ['healthy', 'healthy', 'healthy'],
      memory: {
        heapUsedMb: 100,
        heapTotalMb: 400,
        rssMb: 220,
      },
    });

    expect(status).toBe('healthy');
  });

  it('returns degraded when one service is degraded', () => {
    const status = service.deriveOverallStatus({
      databaseStatus: 'degraded',
      redisStatus: 'healthy',
      queueFailedCounts: [0, 0, 0],
      chainStatuses: ['healthy', 'healthy', 'healthy'],
      memory: {
        heapUsedMb: 100,
        heapTotalMb: 400,
        rssMb: 220,
      },
    });

    expect(status).toBe('degraded');
  });

  it('returns critical when critical threshold is breached', () => {
    const status = service.deriveOverallStatus({
      databaseStatus: 'healthy',
      redisStatus: 'healthy',
      queueFailedCounts: [0, 1200, 0],
      chainStatuses: ['healthy', 'healthy', 'healthy'],
      memory: {
        heapUsedMb: 100,
        heapTotalMb: 400,
        rssMb: 220,
      },
    });

    expect(status).toBe('critical');
  });
});
