import { Controller, Post, Body, Get, Query, Param, Patch, Delete } from '@nestjs/common';
import { TransactionsService } from './token-transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { SimulateTransactionDto } from './dto/simulate-transaction.dto';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto';
import { VoidDisputeDto } from './dto/void-dispute.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private svc: TransactionsService) {}

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.svc.create(dto);
  }

  @Post('simulate')
  simulate(@Body() dto: SimulateTransactionDto) {
    return this.svc.simulate(dto);
  }

  @Get()
  list(@Query('skip') skip?: number, @Query('take') take?: number) {
    return this.svc.list({ skip: Number(skip) || 0, take: Number(take) || 50 });
  }

  @Get(':traceId')
  get(@Param('traceId') traceId: string) {
    return this.svc.findOneByTrace(traceId);
  }

  @Patch(':traceId/reverse')
  reverse(@Param('traceId') traceId: string, @Body() dto: ReverseTransactionDto) {
    // dto.traceId could be omitted, use param
    return this.svc.reverse({ traceId, reason: dto.reason });
  }

  @Patch(':traceId/void')
  voidDispute(@Param('traceId') traceId: string, @Body() dto: VoidDisputeDto) {
    return this.svc.voidDispute(traceId, dto.reason);
  }

  // admin aggregate endpoint for top senders
  @Get('metrics/top-senders')
  async topSenders(@Query('limit') limit = '10') {
    // perform an aggregation in service
    return this.svc.getTopSenders(Number(limit));
  }
}
