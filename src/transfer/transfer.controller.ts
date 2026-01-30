import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransferService } from './transfer.service';
import { TransferReceiptService } from './services/transfer-receipt.service';
import { TransferAnalyticsService } from './services/transfer-analytics.service';
import { TransferTemplateService } from './services/transfer-template.service';
import { TransferLimitService } from './services/transfer-limit.service';
import { ScheduledTransferService } from './services/scheduled-transfer.service';
import { TransferDisputeService } from './services/transfer-dispute.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { CreateBulkTransferDto } from './dto/create-bulk-transfer.dto';
import { TransferQueryDto } from './dto/transfer-query.dto';
import { CreateTransferTemplateDto } from './dto/create-transfer-template.dto';
import { CreateScheduledTransferDto } from './dto/create-scheduled-transfer.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { LimitPeriod } from './entities/transfer-limit.entity';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransferController {
  constructor(
    private readonly transferService: TransferService,
    private readonly receiptService: TransferReceiptService,
    private readonly analyticsService: TransferAnalyticsService,
    private readonly templateService: TransferTemplateService,
    private readonly limitService: TransferLimitService,
    private readonly scheduledTransferService: ScheduledTransferService,
    private readonly disputeService: TransferDisputeService,
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

  // Transfer Templates
  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(
    @Request() req,
    @Body() createTemplateDto: CreateTransferTemplateDto,
  ) {
    const userId = req.user.id || req.user.sub;
    const template = await this.templateService.createTemplate(userId, createTemplateDto);
    
    return {
      success: true,
      message: 'Template created successfully',
      data: template,
    };
  }

  @Get('templates')
  async getTemplates(@Request() req) {
    const userId = req.user.id || req.user.sub;
    const templates = await this.templateService.getTemplates(userId);
    
    return {
      success: true,
      data: templates,
    };
  }

  @Get('templates/favorites')
  async getFavoriteTemplates(@Request() req) {
    const userId = req.user.id || req.user.sub;
    const templates = await this.templateService.getFavorites(userId);
    
    return {
      success: true,
      data: templates,
    };
  }

  @Get('templates/:templateId')
  async getTemplate(
    @Request() req,
    @Param('templateId') templateId: string,
  ) {
    const userId = req.user.id || req.user.sub;
    const template = await this.templateService.getTemplateById(templateId, userId);
    
    return {
      success: true,
      data: template,
    };
  }

  @Put('templates/:templateId')
  async updateTemplate(
    @Request() req,
    @Param('templateId') templateId: string,
    @Body() updateDto: Partial<CreateTransferTemplateDto>,
  ) {
    const userId = req.user.id || req.user.sub;
    const template = await this.templateService.updateTemplate(templateId, userId, updateDto);
    
    return {
      success: true,
      message: 'Template updated successfully',
      data: template,
    };
  }

  @Delete('templates/:templateId')
  async deleteTemplate(
    @Request() req,
    @Param('templateId') templateId: string,
  ) {
    const userId = req.user.id || req.user.sub;
    await this.templateService.deleteTemplate(templateId, userId);
    
    return {
      success: true,
      message: 'Template deleted successfully',
    };
  }

  @Patch('templates/:templateId/favorite')
  async toggleFavorite(
    @Request() req,
    @Param('templateId') templateId: string,
  ) {
    const userId = req.user.id || req.user.sub;
    const template = await this.templateService.toggleFavorite(templateId, userId);
    
    return {
      success: true,
      message: template.isFavorite ? 'Added to favorites' : 'Removed from favorites',
      data: template,
    };
  }

  @Post('templates/:templateId/use')
  async useTemplate(
    @Request() req,
    @Param('templateId') templateId: string,
  ) {
    const userId = req.user.id || req.user.sub;
    const template = await this.templateService.getTemplateById(templateId, userId);
    
    const transfer = await this.transferService.createTransfer(userId, {
      recipientId: template.recipientId,
      amount: parseFloat(template.amount),
      memo: template.memo,
      note: template.note,
      blockchainNetwork: template.blockchainNetwork,
    });

    await this.templateService.incrementUseCount(templateId);
    
    return {
      success: true,
      message: 'Transfer initiated from template',
      data: transfer,
    };
  }

  // Transfer Limits
  @Get('limits')
  async getLimits(@Request() req) {
    const userId = req.user.id || req.user.sub;
    const limits = await this.limitService.getLimits(userId);
    
    return {
      success: true,
      data: limits,
    };
  }

  @Post('limits')
  async setLimit(
    @Request() req,
    @Body() body: { period: LimitPeriod; limitAmount: number; maxTransactionCount?: number },
  ) {
    const userId = req.user.id || req.user.sub;
    const limit = await this.limitService.setLimit(
      userId,
      body.period,
      body.limitAmount,
      body.maxTransactionCount,
    );
    
    return {
      success: true,
      message: 'Transfer limit set successfully',
      data: limit,
    };
  }

  @Delete('limits/:period')
  async removeLimit(
    @Request() req,
    @Param('period') period: LimitPeriod,
  ) {
    const userId = req.user.id || req.user.sub;
    await this.limitService.removeLimit(userId, period);
    
    return {
      success: true,
      message: 'Transfer limit removed successfully',
    };
  }

  // Scheduled Transfers
  @Post('scheduled')
  @HttpCode(HttpStatus.CREATED)
  async createScheduledTransfer(
    @Request() req,
    @Body() createScheduledDto: CreateScheduledTransferDto,
  ) {
    const userId = req.user.id || req.user.sub;
    const scheduledTransfer = await this.scheduledTransferService.createScheduledTransfer(
      userId,
      createScheduledDto,
    );
    
    return {
      success: true,
      message: 'Transfer scheduled successfully',
      data: scheduledTransfer,
    };
  }

  @Get('scheduled')
  async getScheduledTransfers(@Request() req) {
    const userId = req.user.id || req.user.sub;
    const scheduledTransfers = await this.scheduledTransferService.getScheduledTransfers(userId);
    
    return {
      success: true,
      data: scheduledTransfers,
    };
  }

  @Get('scheduled/:scheduledTransferId')
  async getScheduledTransfer(
    @Request() req,
    @Param('scheduledTransferId') scheduledTransferId: string,
  ) {
    const userId = req.user.id || req.user.sub;
    const scheduledTransfer = await this.scheduledTransferService.getScheduledTransferById(
      scheduledTransferId,
      userId,
    );
    
    return {
      success: true,
      data: scheduledTransfer,
    };
  }

  @Post('scheduled/:scheduledTransferId/cancel')
  async cancelScheduledTransfer(
    @Request() req,
    @Param('scheduledTransferId') scheduledTransferId: string,
    @Body() body: { reason?: string },
  ) {
    const userId = req.user.id || req.user.sub;
    const scheduledTransfer = await this.scheduledTransferService.cancelScheduledTransfer(
      scheduledTransferId,
      userId,
      body.reason,
    );
    
    return {
      success: true,
      message: 'Scheduled transfer cancelled successfully',
      data: scheduledTransfer,
    };
  }

  // Transfer Disputes
  @Post(':transferId/dispute')
  @HttpCode(HttpStatus.CREATED)
  async createDispute(
    @Request() req,
    @Param('transferId') transferId: string,
    @Body() createDisputeDto: CreateDisputeDto,
  ) {
    const userId = req.user.id || req.user.sub;
    const dispute = await this.disputeService.createDispute(transferId, userId, createDisputeDto);
    
    return {
      success: true,
      message: 'Dispute created successfully',
      data: dispute,
    };
  }

  @Get('disputes')
  async getDisputes(@Request() req) {
    const userId = req.user.id || req.user.sub;
    const disputes = await this.disputeService.getDisputes(userId);
    
    return {
      success: true,
      data: disputes,
    };
  }

  @Get('disputes/:disputeId')
  async getDispute(
    @Request() req,
    @Param('disputeId') disputeId: string,
  ) {
    const userId = req.user.id || req.user.sub;
    const dispute = await this.disputeService.getDisputeById(disputeId, userId);
    
    return {
      success: true,
      data: dispute,
    };
  }

  @Post('disputes/:disputeId/evidence')
  async addEvidence(
    @Request() req,
    @Param('disputeId') disputeId: string,
    @Body() body: { evidence: string[] },
  ) {
    const userId = req.user.id || req.user.sub;
    const dispute = await this.disputeService.addEvidence(disputeId, userId, body.evidence);
    
    return {
      success: true,
      message: 'Evidence added successfully',
      data: dispute,
    };
  }

  @Get('disputes/statistics')
  async getDisputeStatistics(@Request() req) {
    const userId = req.user.id || req.user.sub;
    const statistics = await this.disputeService.getDisputeStatistics(userId);
    
    return {
      success: true,
      data: statistics,
    };
  }
}
