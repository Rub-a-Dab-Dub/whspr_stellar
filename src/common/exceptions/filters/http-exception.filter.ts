import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { formatErrorResponse } from '../utils/error-response.util';
import { ErrorCode } from 'src/common/enums/error-codes.enum';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    this.logger.error(`${request.method} ${request.url}`, exception.stack);

    const formatted = formatErrorResponse({
      statusCode: status,
      errorCode: exceptionResponse.errorCode || ErrorCode.BAD_REQUEST,
      message: exceptionResponse.message || exception.message,
      path: request.url,
      stack: exception.stack,
    });

    response.status(status).json(formatted);
  }
}
