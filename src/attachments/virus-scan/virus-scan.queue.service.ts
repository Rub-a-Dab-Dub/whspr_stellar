import { Injectable, Logger } from '@nestjs/common';

export interface VirusScanJob {
  attachmentId: string;
  fileKey: string;
  uploaderId: string;
  messageId: string;
}

@Injectable()
export class VirusScanQueueService {
  private readonly logger = new Logger(VirusScanQueueService.name);

  async enqueueAttachmentScan(job: VirusScanJob): Promise<void> {
    setTimeout(() => {
      this.processScan(job);
    }, 0);
  }

  private processScan(job: VirusScanJob): void {
    this.logger.log(
      `Virus scanning queued for attachment=${job.attachmentId} fileKey=${job.fileKey} uploader=${job.uploaderId}`,
    );
  }
}
