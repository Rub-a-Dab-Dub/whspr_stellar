import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { formatErrorResponse } from '../utils/error-response.util';
import { ErrorCode } from 'src/common/enums/error-codes.enum';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const res: any = exception.getResponse();

    if (!res.message || !Array.isArray(res.message)) {
      throw exception;
    }

    const errors = res.message.reduce((acc, msg) => {
      const field = msg.split(' ')[0];
      acc[field] = msg;
      return acc;
    }, {});

    response.status(400).json(
      formatErrorResponse({
        statusCode: 400,
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        path: request.url,
        errors,
      }),
    );
  }
}
