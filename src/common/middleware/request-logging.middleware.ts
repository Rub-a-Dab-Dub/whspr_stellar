import { Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

@Injectable()
export class RequestLoggingMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) ?? randomUUID();
    req.correlationId = correlationId;

    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    const start = Date.now();
    const { method, originalUrl, ip } = req;

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip} [${correlationId}]`,
      );
    });

    next();
  }
}
