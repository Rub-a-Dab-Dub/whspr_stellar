import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { formatErrorResponse } from '../utils/error-response.util';
import { ErrorCode } from 'src/common/enums/error-codes.enum';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    this.logger.error(exception.message, exception.stack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      formatErrorResponse({
        statusCode: 500,
        errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        path: request.url,
        stack: exception.stack,
      }),
    );
  }
}
