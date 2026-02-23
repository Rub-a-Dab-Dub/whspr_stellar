import { HttpStatus } from '@nestjs/common';
import { BaseCustomException } from './base.exception';
import { ErrorCode } from 'src/common/enums/error-codes.enum';

export class BadRequestCustomException extends BaseCustomException {
  constructor(message: string, errors?: any) {
    super(message, HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, errors);
  }
}
