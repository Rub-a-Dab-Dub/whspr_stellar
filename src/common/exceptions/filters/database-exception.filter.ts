import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { formatErrorResponse } from '../utils/error-response.util';
import { ErrorCode } from 'src/common/enums/error-codes.enum';

@Catch()
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    if (!exception.code?.startsWith?.('P2')) return;

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    this.logger.error(exception.message, exception.stack);

    response.status(400).json(
      formatErrorResponse({
        statusCode: 400,
        errorCode: ErrorCode.DATABASE_ERROR,
        message: 'Database operation failed',
        path: request.url,
      }),
    );
  }
}
