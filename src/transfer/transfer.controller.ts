import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransferService } from './transfer.service';
import { TransferReceiptService } from './services/transfer-receipt.service';
import { TransferAnalyticsService } from './services/transfer-analytics.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { CreateBulkTransferDto } from './dto/create-bulk-transfer.dto';
import { TransferQueryDto } from './dto/transfer-query.dto';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransferController {
  constructor(
    private readonly transferService: TransferService,
    private readonly receiptService: TransferReceiptService,
    private readonly analyticsService: TransferAnalyticsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTransfer(
    @Request() req,
    @Body() createTransferDto: CreateTransferDto,
  ) {
    const userId = req.user.id || req.user.sub;
    const transfer = await this.transferService.createTransfer(userId, createTransferDto);
    
    return {
      success: true,
      message: 'Transfer initiated successfully',
      data: transfer,
    };
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async createBulkTransfer(
    @Request() req,
    @Body() createBulkTransferDto: CreateBulkTransferDto,
  ) {
    const userId = req.user.id || req.user.sub;
    const bulkTransfer = await this.transferService.createBulkTransfer(
      userId,
      createBulkTransferDto,
    );
    
    return {
      success: true,
      message: 'Bulk transfer initiated successfully',
      data: bulkTransfer,
    };
  }

  @Get('history')
  async getTransferHistory(
    @Request() req,
    @Query() query: TransferQueryDto,
  ) {
    const userId = req.user.id || req.user.sub;
    const result = await this.transferService.getTransferHistory(userId, query);
    
    return {
      success: true,
      data: result.transfers,
      pagination: {
        total: result.total,
        limit: query.limit || 20,
        offset: query.offset || 0,
      },
    };
  }

  @Get('analytics')
  async getAnalytics(@Request() req, @Query('days') days?: number) {
    const userId = req.user.id || req.user.sub;
    const analytics = await this.analyticsService.getUserAnalytics(
      userId,
      days ? parseInt(days.toString()) : 30,
    );
    
    return {
      success: true,
      data: analytics,
    };
  }

  @Get('bulk/:bulkTransferId')
  async getBulkTransfer(
    @Request() req,
    @Param('bulkTransferId') bulkTransferId: string,
  ) {
    const userId = req.user.id || req.user.sub;
    const bulkTransfer = await this.transferService.getBulkTransferById(
      bulkTransferId,
      userId,
    );
    
    return {
      success: true,
      data: bulkTransfer,
    };
  }

  @Get('bulk/:bulkTransferId/items')
  async getBulkTransferItems(
    @Request() req,
    @Param('bulkTransferId') bulkTransferId: string,
  ) {
    const userId = req.user.id || req.user.sub;
    const items = await this.transferService.getBulkTransferItems(
      bulkTransferId,
      userId,
    );
    
    return {
      success: true,
      data: items,
    };
  }

  @Get(':transferId')
  async getTransfer(
    @Request() req,
    @Param('transferId') transferId: string,
  ) {
    const userId = req.user.id || req.user.sub;
    const transfer = await this.transferService.getTransferById(transferId, userId);
    
    return {
      success: true,
      data: transfer,
    };
  }

  @Get(':transferId/receipt')
  async getReceipt(
    @Request() req,
    @Param('transferId') transferId: string,
  ) {
    const userId = req.user.id || req.user.sub;
    const receipt = await this.receiptService.generateReceipt(transferId, userId);
    
    return {
      success: true,
      data: receipt,
    };
  }
}
