import { HttpStatus } from '@nestjs/common';
import { BaseCustomException } from './base.exception';
import { ErrorCode } from 'src/common/enums/error-codes.enum';

export class BlockchainTransactionException extends BaseCustomException {
  constructor(message: string) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      ErrorCode.BLOCKCHAIN_TRANSACTION_FAILED,
    );
  }
}
