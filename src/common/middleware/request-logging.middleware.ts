import { Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../logger/logger';

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
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) ?? uuidv4();
    req.headers[CORRELATION_ID_HEADER] = correlationId;
    req.correlationId = correlationId;

    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    const start = Date.now();
    const { method, originalUrl, ip } = req;

    res.on('finish', () => {
      logger.info('HTTP Request', {
        method,
        path: originalUrl,
        statusCode: res.statusCode,
        duration: `${Date.now() - start}ms`,
        ip,
        correlationId,
      });
    });

    next();
  }
}
