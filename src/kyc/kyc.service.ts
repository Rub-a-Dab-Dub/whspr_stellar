import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { KYCRecord, KYCStatus, KYCTier } from './entities/kyc-record.entity';
  import { KycProviderService } from './services/kyc-provider/kyc-provider.service';
  import { KycWebhookService } from './services/kyc-webhook/kyc-webhook.service';
  import {
    InitiateKYCDto,
    KYCRequirementsResponseDto,
    KYCStatusResponseDto,
    KYCWebhookDto,
  } from './dto/kyc.dto';
  
  @Injectable()
  export class KycService {
    private readonly logger = new Logger(KycService.name);
    private readonly KYC_TRANSFER_THRESHOLD = 1000;
  
    private readonly TIER_REQUIREMENTS = {
      BASIC: {
        documents: ['government_id'],
        required: false,
        transferThreshold: 1000,
      },
      GOLD: {
        documents: ['government_id', 'proof_of_address'],
        required: true,
        transferThreshold: 0,
      },
      BLACK: {
        documents: ['government_id', 'proof_of_address', 'selfie'],
        required: true,
        transferThreshold: 0,
      },
    };
  
    constructor(
      @InjectRepository(KYCRecord)
      private readonly kycRepository: Repository<KYCRecord>,
      private readonly kycProvider: KycProviderService,
      private readonly kycWebhook: KycWebhookService,
    ) {}
  
    async initiateKYC(
      userId: string,
      dto: InitiateKYCDto,
    ): Promise<{ sessionToken: string; externalId: string }> {
      this.logger.log(`Initiating KYC for user: ${userId}`);
  
      const existing = await this.kycRepository.findOne({
        where: { userId, tier: dto.tier, status: KYCStatus.APPROVED },
      });
  
      if (existing) {
        throw new BadRequestException(
          `User already has approved KYC for tier ${dto.tier}`,
        );
      }
  
      const pending = await this.kycRepository.findOne({
        where: { userId, tier: dto.tier, status: KYCStatus.PENDING },
      });
  
      if (pending) {
        throw new BadRequestException(
          'A KYC verification is already in progress',
        );
      }
  
      const provider = dto.provider ?? 'smile_identity';
      const session = await this.kycProvider.initiateSession(userId, dto.tier);
  
      const record = this.kycRepository.create({
        userId,
        provider,
        externalId: session.externalId,
        sessionToken: session.sessionToken,
        status: KYCStatus.PENDING,
        tier: dto.tier,
      });
  
      await this.kycRepository.save(record);
  
      return {
        sessionToken: session.sessionToken,
        externalId: session.externalId,
      };
    }
  
    async getKYCStatus(userId: string): Promise<KYCStatusResponseDto[]> {
      this.logger.log(`Fetching KYC status for user: ${userId}`);
  
      const records = await this.kycRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
  
      return records.map((record) => ({
        id: record.id,
        userId: record.userId,
        status: record.status,
        tier: record.tier,
        verifiedAt: record.verifiedAt,
        rejectionReason: record.rejectionReason,
        resubmissionAllowedAt: record.resubmissionAllowedAt,
        createdAt: record.createdAt,
      }));
    }
  
    async handleWebhook(webhookDto: KYCWebhookDto): Promise<void> {
      return this.kycWebhook.handleWebhook(webhookDto);
    }
  
    async approveKYC(recordId: string): Promise<KYCRecord> {
      this.logger.log(`Manually approving KYC record: ${recordId}`);
  
      const record = await this.kycRepository.findOne({
        where: { id: recordId },
      });
  
      if (!record) {
        throw new NotFoundException(`KYC record ${recordId} not found`);
      }
  
      record.status = KYCStatus.APPROVED;
      record.verifiedAt = new Date();
      record.rejectionReason = null;
  
      return this.kycRepository.save(record);
    }
  
    async rejectKYC(recordId: string, reason: string): Promise<KYCRecord> {
      this.logger.log(`Rejecting KYC record: ${recordId}`);
  
      const record = await this.kycRepository.findOne({
        where: { id: recordId },
      });
  
      if (!record) {
        throw new NotFoundException(`KYC record ${recordId} not found`);
      }
  
      record.status = KYCStatus.REJECTED;
      record.rejectionReason = reason;
  
      const resubmissionDate = new Date();
      resubmissionDate.setDate(resubmissionDate.getDate() + 7);
      record.resubmissionAllowedAt = resubmissionDate;
  
      return this.kycRepository.save(record);
    }
  
    getKYCRequirements(): KYCRequirementsResponseDto[] {
      return Object.entries(this.TIER_REQUIREMENTS).map(([tier, req]) => ({
        tier,
        required: req.required,
        documents: req.documents,
        transferThreshold: req.transferThreshold,
      }));
    }
  
    async isKYCApproved(userId: string, tier: KYCTier): Promise<boolean> {
      const record = await this.kycRepository.findOne({
        where: { userId, tier, status: KYCStatus.APPROVED },
      });
      return !!record;
    }
  
    async enforceKYCForTransfer(userId: string, amount: number): Promise<void> {
      if (amount >= this.KYC_TRANSFER_THRESHOLD) {
        const hasKYC = await this.isKYCApproved(userId, KYCTier.BASIC);
        if (!hasKYC) {
          throw new BadRequestException(
            `KYC verification required for transfers above ${this.KYC_TRANSFER_THRESHOLD} tokens`,
          );
        }
      }
    }
  
    async enforceKYCForTierUpgrade(
      userId: string,
      targetTier: KYCTier,
    ): Promise<void> {
      const requirement = this.TIER_REQUIREMENTS[targetTier];
      if (requirement.required) {
        const hasKYC = await this.isKYCApproved(userId, targetTier);
        if (!hasKYC) {
          throw new BadRequestException(
            `Approved KYC is required to upgrade to ${targetTier} tier`,
          );
        }
      }
    }
  }