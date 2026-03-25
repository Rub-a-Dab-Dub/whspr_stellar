import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.metricsService.observeRequestDuration(
            request.method,
            request.route?.path || request.path || 'unknown',
            response.statusCode ?? 200,
            Date.now() - startedAt,
          );
        },
        error: () => {
          this.metricsService.observeRequestDuration(
            request.method,
            request.route?.path || request.path || 'unknown',
            response.statusCode ?? 500,
            Date.now() - startedAt,
          );
        },
      }),
    );
  }
}
