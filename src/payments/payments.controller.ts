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
import { PaginatedPaymentHistoryResponseDto as PaginatedHistoryDto } from './dto/payment-history-response.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

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
}
