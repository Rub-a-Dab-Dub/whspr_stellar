import { HttpException } from '@nestjs/common';
import { ErrorCode } from 'src/common/enums/error-codes.enum';

export class BaseCustomException extends HttpException {
  constructor(
    message: string,
    statusCode: number,
    public readonly errorCode: ErrorCode,
    public readonly errors?: any,
  ) {
    super(message, statusCode);
  }
}
