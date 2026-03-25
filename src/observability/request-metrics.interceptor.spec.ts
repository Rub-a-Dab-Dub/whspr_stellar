import { of, throwError } from 'rxjs';
import { RequestMetricsInterceptor } from './request-metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('RequestMetricsInterceptor', () => {
  let interceptor: RequestMetricsInterceptor;
  let metrics: jest.Mocked<MetricsService>;

  beforeEach(() => {
    metrics = {
      observeRequestDuration: jest.fn(),
    } as unknown as jest.Mocked<MetricsService>;
    interceptor = new RequestMetricsInterceptor(metrics);
  });

  it('records successful request durations', (done) => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/metrics', route: { path: '/metrics' } }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as any;

    interceptor.intercept(context, { handle: () => of('ok') } as any).subscribe({
      complete: () => {
        expect(metrics.observeRequestDuration).toHaveBeenCalled();
        done();
      },
    });
  });

  it('records failed request durations', (done) => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/metrics', route: { path: '/metrics' } }),
        getResponse: () => ({ statusCode: 500 }),
      }),
    } as any;

    interceptor
      .intercept(context, { handle: () => throwError(() => new Error('boom')) } as any)
      .subscribe({
        error: () => {
          expect(metrics.observeRequestDuration).toHaveBeenCalled();
          done();
        },
      });
  });
});
