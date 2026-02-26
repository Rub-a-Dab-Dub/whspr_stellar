import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import logger from '../../logger/logger';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export interface StructuredErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  correlationId?: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const raw =
      request.correlationId ?? request.headers[CORRELATION_ID_HEADER];
    const correlationId =
      typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'message' in res) {
        const msg = (res as { message?: string | string[] }).message;
        message = Array.isArray(msg) ? msg : msg ?? exception.message;
      } else {
        message = typeof res === 'string' ? res : exception.message;
      }
      error = exception.name;
    } else if (exception instanceof Error) {
      message = exception.message;
      logger.error('Unhandled Error', {
        name: exception.name,
        message: exception.message,
        stack: exception.stack,
        correlationId,
      });
    }

    const body: StructuredErrorResponse = {
      statusCode: status,
      error,
      message,
      ...(correlationId && { correlationId }),
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
