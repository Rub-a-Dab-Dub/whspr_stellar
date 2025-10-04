import { Module } from '@nestjs/common';
import { TokenTransactionsService } from './token-transactions.service';
import { TokenTransactionsController } from './token-transactions.controller';

@Module({
  controllers: [TokenTransactionsController],
  providers: [TokenTransactionsService],
})
export class TokenTransactionsModule {}
