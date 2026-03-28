import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { FeedbackReportRepository } from './feedback-report.repository';
import { FeedbackReport } from './entities/feedback-report.entity';
import { AttachmentsModule } from '../attachments/attachments.module';
import { LegalModule } from '../legal/legal.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeedbackReport]),
    ScheduleModule.forRoot(), // if cron needed later
    CacheModule.register(),
    AttachmentsModule,
    LegalModule,
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService, FeedbackReportRepository],
  exports: [FeedbackService],
})
export class FeedbackModule {}
