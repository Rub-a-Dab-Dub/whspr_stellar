import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from './logger.service';

declare global {
    namespace Express {
        interface Request {
            id?: string;
            startTime?: number;
        }
    }
}

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
    constructor(private loggerService: LoggerService) { }

    use(req: Request, res: Response, next: NextFunction): void {
        // Generate or use existing request ID
        const requestId = req.headers['x-request-id'] as string || uuidv4();
        req.id = requestId;
        req.startTime = Date.now();

        // Set request ID in logger
        this.loggerService.setRequestId(requestId);

        // Set response header with request ID
        res.setHeader('X-Request-ID', requestId);

        // Log incoming request
        this.loggerService.logRequest(req.method, req.originalUrl, req.body, req.query);

        // Capture original send function
        const originalSend = res.send;
        const loggerService = this.loggerService;

        // Override send to log response
        res.send = function (data: any) {
            const responseTime = Date.now() - req.startTime!;
            const statusCode = res.statusCode;

            // Try to parse response body if it's JSON
            let responseBody: any;
            try {
                responseBody = typeof data === 'string' ? JSON.parse(data) : data;
            } catch {
                responseBody = data;
            }

            loggerService.logResponse(req.method, req.originalUrl, statusCode, responseTime, responseBody);

            // Call original send
            return originalSend.call(this, data);
        };

        next();
    }
}
