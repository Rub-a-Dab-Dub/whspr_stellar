import { HttpStatus } from '@nestjs/common';
import { BaseCustomException } from './base.exception';
import { ErrorCode } from 'src/common/enums/error-codes.enum';

export class UnauthorizedCustomException extends BaseCustomException {
  constructor(message = 'Unauthorized') {
    super(message, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }
}
