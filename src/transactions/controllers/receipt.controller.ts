import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import {
  ExportJobResponseDto,
  ExportStatusResponseDto,
  ExportTransactionsDto,
  ReceiptUrlResponseDto,
} from '../dto/receipt.dto';
import { ReceiptService } from '../services/receipt.service';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Generate (if needed) and retrieve transaction PDF receipt URL' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, type: ReceiptUrlResponseDto })
  getReceipt(
    @CurrentUser('id') userId: string,
    @CurrentUser('walletAddress') walletAddress: string | undefined,
    @Param('id', ParseUUIDPipe) transactionId: string,
  ): Promise<ReceiptUrlResponseDto> {
    return this.receiptService.getReceiptUrl(userId, transactionId, walletAddress);
  }

  @Post('export')
  @ApiOperation({ summary: 'Queue a CSV export for the current user transaction history' })
  @ApiResponse({ status: 201, type: ExportJobResponseDto })
  exportTransactions(
    @CurrentUser('id') userId: string,
    @CurrentUser('walletAddress') walletAddress: string | undefined,
    @Body() filters: ExportTransactionsDto,
  ): Promise<ExportJobResponseDto> {
    return this.receiptService.exportTransactionHistory(userId, filters, walletAddress);
  }

  @Get('export/:jobId/status')
  @ApiOperation({ summary: 'Get transaction export job status' })
  @ApiParam({ name: 'jobId', description: 'Export job identifier' })
  @ApiResponse({ status: 200, type: ExportStatusResponseDto })
  getExportStatus(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ): Promise<ExportStatusResponseDto> {
    return this.receiptService.getExportStatus(userId, jobId);
  }

  @Get('export/:jobId/download')
  @ApiOperation({ summary: 'Get a pre-signed download URL for a completed transaction export' })
  @ApiParam({ name: 'jobId', description: 'Export job identifier' })
  @ApiResponse({ status: 200, type: ReceiptUrlResponseDto })
  downloadExport(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ): Promise<ReceiptUrlResponseDto> {
    return this.receiptService.getExportDownloadUrl(userId, jobId);
  }
}
