import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DataExportRequestRepository } from './data-export-request.repository';
import { ConsentRecordsRepository } from './consent-records.repository';
import { UsersRepository } from '../users/users.repository';
import { DataExportRequest, ExportStatus } from './entities/data-export-request.entity';
import { ConsentRecord, ConsentType } from './entities/consent-record.entity';
import { RequestDataExportDto, DataExportResponseDto, ExportStatusResponseDto } from './dto/data-export.dto';
import { GrantConsentDto, ConsentRecordResponseDto, ConsentHistoryResponseDto, AllConsentsResponseDto } from './dto/consent.dto';
import { DeleteAccountDto, DeleteAccountResponseDto, DataAnonymizationResultDto } from './dto/account-deletion.dto';

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);
  private readonly EXPORT_EXPIRY_HOURS = 48;
  private readonly EXPORT_MAX_RETRIES = 3;
  private readonly ANONYMIZATION_DELAY_DAYS = 30;

  constructor(
    private readonly dataExportRepository: DataExportRequestRepository,
    private readonly consentRepository: ConsentRecordsRepository,
    private readonly usersRepository: UsersRepository,
    @InjectQueue('data-export') private readonly exportQueue: Queue,
  ) {}

  /**
   * Request data export for authenticated user
   */
  async requestDataExport(userId: string): Promise<DataExportResponseDto> {
    // Check for active export request
    const activeExport = await this.dataExportRepository.findActiveExportByUserId(userId);
    if (activeExport) {
      throw new ConflictException(
        'You already have an active export request. Please wait for it to complete or try again later.',
      );
    }

    // Create new export request
    const exportRequest = this.dataExportRepository.create({
      userId,
      status: ExportStatus.PENDING,
    });

    const savedExport = await this.dataExportRepository.save(exportRequest);
    this.logger.log(`Data export request created: ${savedExport.id} for user: ${userId}`);

    // Queue export job
    await this.exportQueue.add(
      'generate-export',
      { exportId: savedExport.id, userId },
      {
        attempts: 1,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: false,
      },
    );

    return this.toExportResponseDto(savedExport);
  }

  /**
   * Get export request status
   */
  async getExportStatus(exportId: string, userId: string): Promise<ExportStatusResponseDto> {
    const exportRequest = await this.dataExportRepository.findExportById(exportId);

    if (!exportRequest) {
      throw new NotFoundException('Export request not found');
    }

    if (exportRequest.userId !== userId) {
      throw new BadRequestException('Unauthorized access to this export');
    }

    const progress = this.calculateExportProgress(exportRequest);
    const estimatedTime = this.estimateRemainingTime(exportRequest);

    return {
      id: exportRequest.id,
      status: exportRequest.status,
      progress,
      estimatedTime,
      fileUrl: exportRequest.fileUrl,
      expiresAt: exportRequest.expiresAt,
      errorMessage: exportRequest.errorMessage,
    };
  }

  /**
   * Download export file
   */
  async downloadExport(exportId: string, userId: string): Promise<{ url: string; expiresAt: Date }> {
    const exportRequest = await this.dataExportRepository.findExportById(exportId);

    if (!exportRequest) {
      throw new NotFoundException('Export request not found');
    }

    if (exportRequest.userId !== userId) {
      throw new BadRequestException('Unauthorized access to this export');
    }

    if (exportRequest.status !== ExportStatus.READY) {
      throw new BadRequestException(
        `Export is not ready for download. Current status: ${exportRequest.status}`,
      );
    }

    if (exportRequest.expiresAt && exportRequest.expiresAt < new Date()) {
      throw new BadRequestException('Export download link has expired. Please request a new export.');
    }

    if (!exportRequest.fileUrl) {
      throw new InternalServerErrorException('Export file URL is missing');
    }

    return {
      url: exportRequest.fileUrl,
      expiresAt: exportRequest.expiresAt!,
    };
  }

  /**
   * Record user consent
   */
  async recordConsent(
    userId: string,
    grantDto: GrantConsentDto,
    ipAddress?: string,
  ): Promise<ConsentRecordResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const consentRecord = this.consentRepository.create({
      userId,
      consentType: grantDto.consentType,
      isGranted: grantDto.isGranted,
      ipAddress,
      userAgent: grantDto.userAgent,
    });

    const savedRecord = await this.consentRepository.save(consentRecord);
    this.logger.log(
      `Consent recorded for user ${userId}: ${grantDto.consentType} = ${grantDto.isGranted}`,
    );

    return this.toConsentResponseDto(savedRecord);
  }

  /**
   * Revoke consent
   */
  async revokeConsent(userId: string, consentType: ConsentType): Promise<ConsentRecordResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentConsent = await this.consentRepository.findCurrentConsent(userId, consentType);
    if (!currentConsent || currentConsent.revokedAt) {
      throw new BadRequestException(`No active consent found for ${consentType}`);
    }

    currentConsent.revokedAt = new Date();
    const updatedRecord = await this.consentRepository.save(currentConsent);

    this.logger.log(`Consent revoked for user ${userId}: ${consentType}`);

    return this.toConsentResponseDto(updatedRecord);
  }

  /**
   * Get consent history for user
   */
  async getConsentHistory(userId: string, consentType?: ConsentType): Promise<ConsentHistoryResponseDto | AllConsentsResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (consentType) {
      const history = await this.consentRepository.findConsentHistory(userId, consentType);
      const currentConsent = history[0] || null;

      return {
        consentType,
        currentStatus: currentConsent ? currentConsent.isGranted && !currentConsent.revokedAt : false,
        history: history.map((record) => this.toConsentResponseDto(record)),
      };
    }

    // Return all consent types
    const allCurrentConsents = await this.consentRepository.findAllCurrentConsents(userId);
    const response: AllConsentsResponseDto = {};

    for (const consentTypeKey in ConsentType) {
      const type = ConsentType[consentTypeKey as keyof typeof ConsentType];
      const consent = allCurrentConsents.find((c) => c.consentType === type);

      response[type] = {
        isGranted: consent ? consent.isGranted && !consent.revokedAt : false,
        grantedAt: consent?.grantedAt || new Date(),
        revokedAt: consent?.revokedAt || null,
      };
    }

    return response;
  }

  /**
   * Delete user account (schedule for anonymization)
   */
  async deleteAccount(userId: string, deleteDto: DeleteAccountDto): Promise<DeleteAccountResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + this.ANONYMIZATION_DELAY_DAYS);

    // Queue anonymization job
    const cancellationToken = `cancel-${userId}-${Date.now()}`;
    await this.exportQueue.add(
      'anonymize-account',
      { userId, cancellationToken },
      {
        delay: this.ANONYMIZATION_DELAY_DAYS * 24 * 60 * 60 * 1000,
        jobId: `anonymize-${userId}`,
      },
    );

    this.logger.log(`Account deletion scheduled for user ${userId}, expires: ${scheduledFor}`);

    return {
      success: true,
      message: `Your account will be permanently deleted on ${scheduledFor.toISOString()}. You can cancel this request within 30 days.`,
      scheduledFor,
      cancellationToken,
    };
  }

  /**
   * Process data export (called by queue worker)
   */
  async processDataExport(exportId: string, userId: string): Promise<void> {
    const exportRequest = await this.dataExportRepository.findExportById(exportId);
    if (!exportRequest) {
      this.logger.error(`Export request not found: ${exportId}`);
      return;
    }

    try {
      exportRequest.status = ExportStatus.PROCESSING;
      await this.dataExportRepository.save(exportRequest);

      // Simulate export generation (in production, would create actual ZIP)
      const fileUrl = await this.generateExportFile(userId, exportId);

      exportRequest.status = ExportStatus.READY;
      exportRequest.fileUrl = fileUrl;
      exportRequest.completedAt = new Date();
      exportRequest.expiresAt = new Date(Date.now() + this.EXPORT_EXPIRY_HOURS * 60 * 60 * 1000);

      await this.dataExportRepository.save(exportRequest);
      this.logger.log(`Data export completed: ${exportId}`);
    } catch (error) {
      this.logger.error(`Error processing export ${exportId}: ${error}`);
      exportRequest.status = ExportStatus.FAILED;
      exportRequest.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      exportRequest.retryCount = (exportRequest.retryCount || 0) + 1;

      if (exportRequest.retryCount < this.EXPORT_MAX_RETRIES) {
        exportRequest.status = ExportStatus.PENDING;
      }

      await this.dataExportRepository.save(exportRequest);
    }
  }

  /**
   * Anonymize user account (called by queue worker)
   */
  async anonymizeAccount(userId: string): Promise<DataAnonymizationResultDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const fieldsAnonymized: string[] = [];

    try {
      // Anonymize PII
      user.username = null;
      user.email = null;
      user.displayName = 'Deleted User';
      user.avatarUrl = null;
      user.bio = null;
      user.preferredLocale = null;

      await this.usersRepository.save(user);
      fieldsAnonymized.push('username', 'email', 'displayName', 'avatarUrl', 'bio', 'preferredLocale');

      // Retain transaction records for 7-year compliance (no delete)
      // Anonymize consent records
      const consents = await this.consentRepository.find({ where: { userId } });
      await this.consentRepository.remove(consents);

      // Anonymize export requests
      const exports = await this.dataExportRepository.find({ where: { userId } });
      exports.forEach((exp) => {
        exp.fileUrl = null;
        exp.errorMessage = null;
      });
      await this.dataExportRepository.save(exports);

      this.logger.log(`Account anonymized for user ${userId}`);

      return {
        userId,
        fieldsAnonymized,
        transactionsRetained: 0, // Would count actual transactions in production
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error anonymizing account ${userId}: ${error}`);
      throw new InternalServerErrorException('Failed to anonymize account');
    }
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpiredExports(): Promise<number> {
    const expiredExports = await this.dataExportRepository.findExpiredExports(new Date());

    for (const exp of expiredExports) {
      exp.status = ExportStatus.EXPIRED;
      exp.fileUrl = null;
      await this.dataExportRepository.save(exp);
    }

    this.logger.log(`Cleaned up ${expiredExports.length} expired exports`);
    return expiredExports.length;
  }

  // ==================== Helper Methods ====================

  private async generateExportFile(userId: string, exportId: string): Promise<string> {
    // In production: fetch user data, create ZIP, upload to S3
    // For now, return mock S3 URL
    return `https://cdn.example.com/exports/${exportId}.zip`;
  }

  private toExportResponseDto(entity: DataExportRequest): DataExportResponseDto {
    return plainToInstance(DataExportResponseDto, entity, {
      excludeExtraneousValues: false,
    });
  }

  private toConsentResponseDto(entity: ConsentRecord): ConsentRecordResponseDto {
    return plainToInstance(ConsentRecordResponseDto, entity, {
      excludeExtraneousValues: false,
    });
  }

  private calculateExportProgress(exportRequest: DataExportRequest): number {
    switch (exportRequest.status) {
      case ExportStatus.PENDING:
        return 0;
      case ExportStatus.PROCESSING:
        return 50;
      case ExportStatus.READY:
        return 100;
      default:
        return 0;
    }
  }

  private estimateRemainingTime(exportRequest: DataExportRequest): number {
    switch (exportRequest.status) {
      case ExportStatus.PENDING:
      case ExportStatus.PROCESSING:
        return 5 * 60; // 5 minutes in seconds
      default:
        return 0;
    }
  }
}
