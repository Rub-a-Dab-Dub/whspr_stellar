import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Query,
  Req,
  UseGuards,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../two-factor/guards/two-factor-auth.guard';
import { PaymentsService } from './payments.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PaginatedPaymentHistoryDto } from './dto/paginated-payment-history.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Query,
  Req,
  UseGuards,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../two-factor/guards/two-factor-auth.guard';
import { GoldBlackTierGuard } from './guards/gold-black-tier.guard';
import { PaymentsService } from './payments.service';
import { BulkPaymentService } from './bulk-payment.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PaginatedPaymentHistoryDto } from './dto/paginated-payment-history.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { PaginatedPaymentHistoryResponseDto as PaginatedHistoryDto } from './dto/payment-history-response.dto';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { PaginatedBulkPaymentsDto, BulkPaymentDto } from './dto/bulk-payment.dto';
import { BulkPaymentRowsQueryDto } from './dto/bulk-payment-row-list.dto';
import { PaginatedBulkPaymentRowsDto } from './dto/paginated-bulk-payment-rows.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly bulkService: BulkPaymentService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Paystack checkout session for tier upgrade' })
  @ApiResponse({ status: 201, description: 'Checkout URL returned' })
  async createCheckout(@Req() req: any, @Body() dto: CreateCheckoutDto) {
    return this.service.createCheckoutSession(dto, req.user.id);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook handler' })
  async handleWebhook(@Body() body: any, @Req() req: RawBodyRequest<Request>) {
    const signature = req.rawBody.toString();
    return this.service.handleWebhook(body, signature);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('subscription')
  @ApiOperation({ summary: 'Get current user subscription' })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  async getSubscription(@Req() req: any) {
    const sub = await this.service.getSubscription(req.user.id);
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  @UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
  @ApiBearerAuth()
  @Delete('subscription')
  @ApiOperation({ summary: 'Cancel subscription (effective period end)' })
  async cancelSubscription(@Req() req: any) {
    await this.service.cancelSubscription(req.user.id);
    return { message: 'Subscription cancelled successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('history')
  @ApiOperation({ summary: 'Get paginated payment history' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'] })
  @ApiResponse({ status: 200, type: PaginatedHistoryDto })
  async getPaymentHistory(@Req() req: any, @Query() dto: PaginatedPaymentHistoryDto) {
    return this.service.getPaymentHistory(req.user.id, dto);
  }

  // === BULK PAYMENTS ENDPOINTS ===

  @Post('bulk')
  @UseGuards(JwtAuthGuard, TwoFactorAuthGuard, GoldBlackTierGuard)
  @UseInterceptors(FileInterceptor('csv'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload CSV for bulk payment disbursement' })
  @ApiResponse({ status: 201, type: BulkPaymentDto })
  async uploadBulkPayment(
    @Req() req: any,
    @Body() dto: BulkUploadDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    ) csvFile: Express.Multer.File,
  ) {
    return this.bulkService.upload(req.user.id, dto, csvFile);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('bulk')
  @ApiOperation({ summary: 'List user's bulk payments' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listBulkPayments(@Req() req: any, @Query() query: { page?: number; limit?: number }) {
    return this.bulkService.listUserBulkPayments(req.user.id, query.page || 0, query.limit || 20);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('bulk/:id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get bulk payment detail with progress' })
  async getBulkPayment(@Req() req: any, @Param('id') id: string) {
    return this.bulkService.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('bulk/:id/rows')
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'status', enum: ['pending', 'success', 'failed'], required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getBulkPaymentRows(@Param('id') id: string, @Query() query: BulkPaymentRowsQueryDto) {
    return this.bulkService.getRowsById(id, query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('bulk/:id/export')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Download results CSV' })
  async exportBulkPaymentRows(@Param('id') id: string, @Res() res) {
    const csv = await this.bulkService.exportRowsCsv(id);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="bulk-payment-${id}-results.csv"`,
    });
    res.send(csv);
  }
}

