import { Controller, Post, Get, Body, Query, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferQueryDto } from './dto/transfer-query.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  async createTransfer(
    @Request() req: { user: { id?: string; sub?: string } },
    @Body() dto: CreateTransferDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    const payment = await this.paymentsService.createTransfer(
      userId,
      dto.recipient,
      dto.amount,
      dto.tokenAddress,
    );
    return {
      success: true,
      message: 'Transfer initiated successfully',
      data: payment,
    };
  }

  @Get('transfers')
  async getTransfers(
    @Request() req: { user: { id?: string; sub?: string } },
    @Query() query: TransferQueryDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    const { payments, total } = await this.paymentsService.getTransfers(
      userId,
      query.limit ?? 20,
      query.offset ?? 0,
    );
    return {
      success: true,
      data: payments,
      pagination: {
        total,
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
      },
    };
  }
}
