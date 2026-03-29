import { Controller, Get, Post, Param, Body, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { ReceiptsService } from './receipts.service';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get(':txHash/receipt')
  generateReceipt(@Param('txHash') txHash: string, @Res() res: Response) {
    // Validate txHash as a valid Stellar transaction hash (64 hex chars)
    if (!/^[a-f0-9]{64}$/i.test(txHash)) {
      throw new BadRequestException('Invalid transaction hash');
    }
    const buffer = this.receiptsService.generateReceipt(txHash);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=receipt.pdf',
    });
    res.send(buffer);
  }

  @Post('export')
  exportTransactionHistory(@Body() body: { userId: string; format: 'csv' | 'pdf' }) {
    return this.receiptsService.exportTransactionHistory(body.userId, body.format);
  }
}
