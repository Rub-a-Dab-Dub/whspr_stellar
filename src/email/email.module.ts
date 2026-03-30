import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EMAIL_PROVIDER_TOKEN } from './constants';
import { EmailDeliveriesRepository, EmailUnsubscribesRepository } from './email.repository';
import { EmailQueueService } from './email-queue.service';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailWorkerService } from './email-worker.service';
import { EmailDelivery } from './entities/email-delivery.entity';
import { EmailUnsubscribe } from './entities/email-unsubscribe.entity';
import { HttpEmailProvider } from './providers/http-email.provider';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailDelivery, EmailUnsubscribe])],
  providers: [
    EmailDeliveriesRepository,
    EmailUnsubscribesRepository,
    EmailTemplateService,
    EmailQueueService,
    EmailWorkerService,
    EmailService,
    HttpEmailProvider,
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useExisting: HttpEmailProvider,
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
