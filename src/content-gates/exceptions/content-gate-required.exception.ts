import { HttpException, HttpStatus } from '@nestjs/common';
import { GateRequirementSummary } from '../content-gates.types';

export class ContentGateRequiredException extends HttpException {
  constructor(gates: GateRequirementSummary[]) {
    super(
      {
        error: 'Payment Required',
        message: 'Token gate requirements are not satisfied for this content.',
        gates,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
