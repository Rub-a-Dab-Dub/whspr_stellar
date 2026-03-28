import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentRequest, PaymentRequestStatus } from './entities/payment-request.entity';
import { PaymentRequestRepository } from './payment-requests.repository';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { PaymentRequestResponseDto, PaymentRequestsListResponseDto } from './dto/payment-request-response.dto';
import { InChatTransfersService } from '../in-chat-transfers/in-chat-transfers.service';
// import { ChatGateway } from '../messaging/gateways/chat.gateway'; // for WS emit

@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly repo: PaymentRequestRepository,
    private readonly notificationsService: NotificationsService,
    private readonly inChatTransfersService: InChatTransfersService,
    // private readonly chatGateway: ChatGateway,
  ) {}

  async createRequest(conversationId: string, dto: CreatePaymentRequestDto, requesterId: string): Promise<PaymentRequestResponseDto> {
    // Validate payer in conversation (simplified)
    const request = this.repo.create({
      requesterId,
      payerId: dto.payerId,
      conversationId,
      asset: dto.asset,
      amount: dto.amount.toString(),
      note: dto.note,
      status: PaymentRequestStatus.PENDING,
      expiresAt: new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000),
    });

    const saved = await this.repo.save(request);

    // Notify payer
    await this.notificationsService.createNotification({
      userId: dto.payerId,
      type: 'PAYMENT_REQUEST_RECEIVED', // add to enum
      title: 'Payment Request',
      body: `New payment request from you for ${dto.amount} ${dto.asset}`,
      data: { requestId: saved.id },
    });

    // TODO: emit WS 'payment_request:new' to payer/conversation room
    // this.chatGateway.server.to(`conversation_${conversationId}`).emit('payment_request:new', { id: saved.id });

    // TODO: create interactive message bubble

    return this.toResponse(saved);
  }

  async getRequests(userId: string, limit = 50, cursor?: string): Promise<PaymentRequestsListResponseDto> {
    const requests = await this.repo.getRequestsForUser(userId, true, limit, cursor);
    return {
      data: requests.map(r => this.toResponse(r)),
      total: requests.length, // simplified
    };
  }

  async getPendingRequests(payerId: string): Promise<PaymentRequestsListResponseDto> {
    const requests = await this.repo.getPendingRequestsForPayer(payerId);
    return {
      data: requests.map(r => this.toResponse(r)),
      total: requests.length,
    };
  }

  async acceptRequest(id: string, userId: string): Promise<PaymentRequestResponseDto> {
    const request = await this.repo.findOne({
      where: { id },
      relations: ['conversation', 'requester', 'payer'],
    });

    if (!request) throw new NotFoundException();
    if (request.status !== PaymentRequestStatus.PENDING) throw new BadRequestException('Cannot accept non-pending request');
    if (request.payerId !== userId) throw new BadRequestException('Only payer can accept');
    if (request.expiresAt && request.expiresAt < new Date()) throw new BadRequestException('Request expired');

    // Trigger in-chat transfer with prefilled
    const transferPreview = await this.inChatTransfersService.initiateTransfer(
      userId,
      request.conversationId,
      {
        rawCommand: `/tip @${request.requester.username || request.requesterId} ${request.amount} ${request.asset}`, // synthetic
      },
    );

    request.status = PaymentRequestStatus.PAID;
    request.paidAt = new Date();
    request.transferId = transferPreview.transferId; // assume returns id
    await this.repo.save(request);

    // Notify requester
    await this.notificationsService.createNotification({
      userId: request.requesterId,
      type: 'PAYMENT_REQUEST_PAID',
      title: 'Payment Request Paid',
      body: `Your request for ${request.amount} ${request.asset} has been paid!`,
      data: { requestId: id },
    });

    // TODO: emit WS 'payment_request:paid'

    return this.toResponse(request);
  }

  async declineRequest(id: string, userId: string): Promise<void> {
    const request = await this.updateStatus(id, userId, PaymentRequestStatus.DECLINED, 'Payment request declined');
    // notify + WS
  }

  async cancelRequest(id: string, requesterId: string): Promise<void> {
    const request = await this.updateStatus(id, requesterId, PaymentRequestStatus.CANCELLED, 'Payment request cancelled');
    // notify payer + WS
  }

  private async updateStatus(id: string, userId: string, status: PaymentRequestStatus, message: string): Promise<PaymentRequest> {
    const request = await this.repo.findOne({ where: { id } });
    if (!request) throw new NotFoundException();
    // auth check based on status
    request.status = status;
    return await this.repo.save(request);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleExpiry(): Promise<void> {
    const count = await this.repo.expireStaleRequests();
    if (count > 0) {
      // TODO: notify requesters of expired requests
      console.log(`Expired ${count} stale payment requests`);
    }
  }

  private toResponse(request: PaymentRequest): PaymentRequestResponseDto {
    const now = new Date();
    return {
      id: request.id,
      requesterId: request.requesterId,
      requesterUsername: request.requester?.username,
      payerId: request.payerId,
      payerUsername: request.payer?.username,
      conversationId: request.conversationId,
      asset: request.asset,
      amount: request.amount,
      note: request.note,
      status: request.status,
      expiresAt: request.expiresAt,
      timeRemainingMs: request.status === PaymentRequestStatus.PENDING && request.expiresAt ? request.expiresAt.getTime() - now.getTime() : undefined,
      paidAt: request.paidAt,
      createdAt: request.createdAt,
    };
  }
}
