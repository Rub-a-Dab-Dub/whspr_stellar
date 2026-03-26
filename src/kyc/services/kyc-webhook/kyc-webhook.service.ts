import { Injectable, Logger } from '@nestjs/common';
import { KYCWebhookDto } from '../../dto/kyc.dto';
import { KYCRecord, KYCStatus } from '../../entities/kyc-record.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class KycWebhookService {
  private readonly logger = new Logger(KycWebhookService.name);

  constructor(
    @InjectRepository(KYCRecord)
    private readonly kycRepository: Repository<KYCRecord>,
  ) {}

  async handleWebhook(webhookDto: KYCWebhookDto): Promise<void> {
    this.logger.log(
      `Processing webhook for externalId: ${webhookDto.externalId}`,
    );

    const record = await this.kycRepository.findOne({
      where: { externalId: webhookDto.externalId },
    });

    if (!record) {
      this.logger.warn(
        `No KYC record found for externalId: ${webhookDto.externalId}`,
      );
      return;
    }

    await this.updateKYCStatus(record, webhookDto);
  }

  private async updateKYCStatus(
    record: KYCRecord,
    webhookDto: KYCWebhookDto,
  ): Promise<void> {
    const status = this.mapProviderStatus(webhookDto.status);

    record.status = status;

    if (status === KYCStatus.APPROVED) {
      record.verifiedAt = new Date();
      record.rejectionReason = null;
    }

    if (status === KYCStatus.REJECTED) {
      record.rejectionReason = webhookDto.rejectionReason ?? 'Verification failed';
      // Allow resubmission after 7 days
      const resubmissionDate = new Date();
      resubmissionDate.setDate(resubmissionDate.getDate() + 7);
      record.resubmissionAllowedAt = resubmissionDate;
    }

    if (webhookDto.documents) {
      record.documents = webhookDto.documents;
    }

    await this.kycRepository.save(record);
    this.logger.log(
      `KYC record ${record.id} updated to status: ${status}`,
    );
  }

  private mapProviderStatus(providerStatus: string): KYCStatus {
    const statusMap: Record<string, KYCStatus> = {
      approved: KYCStatus.APPROVED,
      success: KYCStatus.APPROVED,
      verified: KYCStatus.APPROVED,
      rejected: KYCStatus.REJECTED,
      failed: KYCStatus.REJECTED,
      pending: KYCStatus.PENDING,
      processing: KYCStatus.PENDING,
      expired: KYCStatus.EXPIRED,
    };

    return statusMap[providerStatus.toLowerCase()] ?? KYCStatus.PENDING;
  }
}