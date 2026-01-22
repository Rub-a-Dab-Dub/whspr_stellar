import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse();
    const userAgent = req.get('user-agent') || '';
    const { method, originalUrl, ip } = req;
    const correlationId = req.headers['x-correlation-id'];

    const now = Date.now();

    this.logger.log({
      message: `Incoming Request: ${method} ${originalUrl}`,
      context: 'HTTP',
      correlationId,
      method,
      url: originalUrl,
      body: this.sanitize(req.body),
      query: req.query,
      params: req.params,
      ip,
      userAgent,
    });

    return next.handle().pipe(
      tap(() => {
        const delay = Date.now() - now;
        const { statusCode } = res;

        this.logger.log({
            message: `Outgoing Response: ${method} ${originalUrl} ${statusCode} - ${delay}ms`,
            context: 'HTTP',
            correlationId,
            method,
            url: originalUrl,
            statusCode,
            duration: `${delay}ms`,
        });
      }),
    );
  }

  private sanitize(body: any): any {
      if (!body) return body;
      const sanitized = { ...body };
      // Redact sensitive fields
      if (sanitized.password) sanitized.password = '***';
      if (sanitized.token) sanitized.token = '***';
      return sanitized;
  }
}
