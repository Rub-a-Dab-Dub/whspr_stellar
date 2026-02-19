import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ADMIN_STREAM_EVENTS } from '../gateways/admin-event-stream.gateway';

/**
 * Emits platform.error to admin event stream for critical server errors (5xx).
 */
@Catch()
export class AdminPlatformErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AdminPlatformErrorFilter.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : 'Unknown error';

    if (status >= 500) {
      this.eventEmitter.emit(ADMIN_STREAM_EVENTS.PLATFORM_ERROR, {
        type: 'platform.error',
        timestamp: new Date().toISOString(),
        entity: {
          message,
          code: String(status),
          context: `${request.method} ${request.url}`,
        },
      });
      this.logger.error(`Platform error: ${message}`);
    }

    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    response.status(status).json(errorResponse);
  }
}
