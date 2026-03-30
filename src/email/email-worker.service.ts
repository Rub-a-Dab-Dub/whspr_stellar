import { Injectable, OnModuleInit } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailQueueService } from './email-queue.service';

@Injectable()
export class EmailWorkerService implements OnModuleInit {
  constructor(
    private readonly queueService: EmailQueueService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerWorker(async ({ deliveryId }) => {
      await this.emailService.processDelivery(deliveryId);
    });
  }
}
