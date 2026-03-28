import { Test, TestingModule } from '@nestjs/testing';
import { PaymentRequestsService } from './payment-requests.service';
import { PaymentRequestRepository } from './payment-requests.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentRequest } from './entities/payment-request.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { InChatTransfersService } from '../in-chat-transfers/in-chat-transfers.service';

describe('PaymentRequestsService', () => {
  let service: PaymentRequestsService;
  let repo: jest.Mocked<PaymentRequestRepository>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRequestsService,
        { provide: PaymentRequestRepository, useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: NotificationsService, useValue: { createNotification: jest.fn() } },
        { provide: InChatTransfersService, useValue: { initiateTransfer: jest.fn() } },
      ],
    }).compile();

    service = module.get<PaymentRequestsService>(PaymentRequestsService);
    repo = module.get(PaymentRequestRepository);
    notificationsService = module.get(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more tests for coverage
});
