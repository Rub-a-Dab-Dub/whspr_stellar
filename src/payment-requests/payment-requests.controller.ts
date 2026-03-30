import { Controller, Post, Get, Param, Body, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentRequestsService } from './payment-requests.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { PaymentRequestsListResponseDto, PaymentRequestResponseDto } from './dto/payment-request-response.dto';
// import { CurrentUser } from '../common/decorators/current-user.decorator'; // assume exists

@ApiTags('payment-requests')
@ApiBearerAuth()
@Controller('payment-requests')
export class PaymentRequestsController {
  constructor(private readonly service: PaymentRequestsService) {}

  @Post('conversations/:conversationId')
  @ApiOperation({ summary: 'Create payment request in conversation' })
  async create(
    @Param('conversationId') conversationId: string,
    @Body() dto: CreatePaymentRequestDto,
    // @CurrentUser('sub') requesterId: string,
    @Req() req: any,
  ): Promise<PaymentRequestResponseDto> {
    const requesterId = req.headers['x-user-id']; // assume header
    return this.service.createRequest(conversationId, dto, requesterId);
  }

  @Get()
  @ApiOperation({ summary: 'Get payment requests for current user (requester)' })
  async getRequests(): Promise<PaymentRequestsListResponseDto> {
    // requesterId from current user
    const userId = 'current-user-id'; // TODO
    return this.service.getRequests(userId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending payment requests for current user (payer)' })
  async getPending(): Promise<PaymentRequestsListResponseDto> {
    const userId = 'current-user-id'; // TODO
    return this.service.getPendingRequests(userId);
  }

  @Post(':id/accept')
  async accept(@Param('id') id: string, @Req() req: any): Promise<PaymentRequestResponseDto> {
    const userId = req.headers['x-user-id'];
    return this.service.acceptRequest(id, userId);
  }

  @Post(':id/decline')
  async decline(@Param('id') id: string, @Req() req: any): Promise<void> {
    const userId = req.headers['x-user-id'];
    return this.service.declineRequest(id, userId);
  }

  @Delete(':id')
  async cancel(@Param('id') id: string, @Req() req: any): Promise<void> {
    const requesterId = req.headers['x-user-id'];
    return this.service.cancelRequest(id, requesterId);
  }
}
