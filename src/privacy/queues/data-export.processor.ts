import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrivacyService } from './privacy.service';

@Processor('data-export')
export class DataExportProcessor {
  private readonly logger = new Logger(DataExportProcessor.name);

  constructor(private readonly privacyService: PrivacyService) {}

  @Process('generate-export')
  async handleGenerateExport(job: Job<{ exportId: string; userId: string }>) {
    const { exportId, userId } = job.data;
    this.logger.log(`Processing export generation: ${exportId}`);

    try {
      await this.privacyService.processDataExport(exportId, userId);
      return { success: true, exportId };
    } catch (error) {
      this.logger.error(`Failed to generate export ${exportId}: ${error}`);
      throw error;
    }
  }

  @Process('anonymize-account')
  async handleAnonymizeAccount(job: Job<{ userId: string; cancellationToken: string }>) {
    const { userId } = job.data;
    this.logger.log(`Processing account anonymization: ${userId}`);

    try {
      await this.privacyService.anonymizeAccount(userId);
      return { success: true, userId };
    } catch (error) {
      this.logger.error(`Failed to anonymize account ${userId}: ${error}`);
      throw error;
    }
  }

  @Process('cleanup-expired-exports')
  async handleCleanupExpiredExports() {
    this.logger.log('Starting cleanup of expired exports');

    try {
      const cleaned = await this.privacyService.cleanupExpiredExports();
      return { success: true, cleaned };
    } catch (error) {
      this.logger.error(`Failed to cleanup expired exports: ${error}`);
      throw error;
    }
  }
}
