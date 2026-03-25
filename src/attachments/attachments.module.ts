import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from './entities/attachment.entity';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentsRepository } from './attachments.repository';
import { S3StorageService } from './storage/s3-storage.service';
import { VirusScanQueueService } from './virus-scan/virus-scan.queue.service';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    AttachmentsRepository,
    S3StorageService,
    VirusScanQueueService,
  ],
  exports: [AttachmentsService, AttachmentsRepository],
})
export class AttachmentsModule {}
