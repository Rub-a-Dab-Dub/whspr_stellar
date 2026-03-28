import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LegalDocument, LegalDocumentStatus, LegalDocumentType } from './entities/legal-document.entity';
import { UserConsent } from './entities/user-consent.entity';
import { LegalDocumentRepository } from './legal-document.repository';
import { UserConsentRepository } from './user-consent.repository';
import { CreateLegalDocumentDto, LegalDocumentResponseDto } from './dto/legal-document.dto';
import { ConsentStatusDto, UserConsentResponseDto } from './dto/user-consent.dto';
import { LegalEmailService } from './legal-email.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class LegalService {
  private readonly logger = new Logger(LegalService.name);

  constructor(
    private readonly documentRepo: LegalDocumentRepository,
    private readonly consentRepo: UserConsentRepository,
    private readonly emailService: LegalEmailService,
    private readonly usersService: UsersService,
  ) {}

  // ── Document management ────────────────────────────────────────────────────

  async createDraft(dto: CreateLegalDocumentDto, adminId: string): Promise<LegalDocumentResponseDto> {
    const existing = await this.documentRepo.findByTypeAndVersion(dto.type, dto.version);
    if (existing) {
      throw new ConflictException(`A document of type ${dto.type} with version ${dto.version} already exists`);
    }

    const doc = this.documentRepo.create({
      type: dto.type,
      version: dto.version,
      content: dto.content,
      title: dto.title ?? null,
      summary: dto.summary ?? null,
      status: LegalDocumentStatus.DRAFT,
      publishedBy: adminId,
    });

    const saved = await this.documentRepo.save(doc);
    this.logger.log(`Admin ${adminId} created draft ${saved.type} v${saved.version}`);
    return this.toDocumentDto(saved);
  }

  async publishDocument(id: string, adminId: string): Promise<LegalDocumentResponseDto> {
    const doc = await this.documentRepo.findById(id);
    if (!doc) {
      throw new NotFoundException('Legal document not found');
    }

    if (doc.status !== LegalDocumentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT documents can be published');
    }

    // Archive any currently active document of the same type
    await this.documentRepo.archiveActiveDocuments(doc.type);

    doc.status = LegalDocumentStatus.ACTIVE;
    doc.publishedAt = new Date();
    doc.publishedBy = adminId;

    const saved = await this.documentRepo.save(doc);
    this.logger.log(`Admin ${adminId} published ${saved.type} v${saved.version}`);

    // Fire-and-forget email notifications
    this.sendPublishNotifications(saved).catch((err) =>
      this.logger.error('Failed to send publish notifications', err),
    );

    return this.toDocumentDto(saved);
  }

  async getActiveDocument(type: LegalDocumentType): Promise<LegalDocumentResponseDto> {
    const doc = await this.documentRepo.findActive(type);
    if (!doc) {
      throw new NotFoundException(`No active ${type} document found`);
    }
    return this.toDocumentDto(doc);
  }

  async getAllActiveDocuments(): Promise<LegalDocumentResponseDto[]> {
    const docs = await this.documentRepo.findAllActive();
    return docs.map((d) => this.toDocumentDto(d));
  }

  // ── Consent management ─────────────────────────────────────────────────────

  async recordConsent(
    userId: string,
    documentId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<UserConsentResponseDto> {
    const doc = await this.documentRepo.findById(documentId);
    if (!doc) {
      throw new NotFoundException('Legal document not found');
    }

    if (doc.status !== LegalDocumentStatus.ACTIVE) {
      throw new BadRequestException('Consent can only be recorded for active documents');
    }

    const consent = this.consentRepo.create({
      userId,
      documentId,
      documentVersion: doc.version,
      ipAddress,
      userAgent,
    });

    const saved = await this.consentRepo.upsert(consent);
    return this.toConsentDto(saved);
  }

  async checkConsent(userId: string, documentId: string): Promise<ConsentStatusDto> {
    const consent = await this.consentRepo.findByUserAndDocument(userId, documentId);
    if (!consent) {
      return { hasAccepted: false };
    }
    return {
      hasAccepted: true,
      acceptedAt: consent.acceptedAt,
      documentVersion: consent.documentVersion,
    };
  }

  async hasAcceptedLatestTerms(userId: string): Promise<boolean> {
    const activeDoc = await this.documentRepo.findActive(LegalDocumentType.TERMS_OF_SERVICE);
    if (!activeDoc) {
      // No ToS published yet — don't block
      return true;
    }

    const consent = await this.consentRepo.findByUserAndDocument(userId, activeDoc.id);
    return !!consent;
  }

  async getConsentHistory(userId: string): Promise<UserConsentResponseDto[]> {
    const consents = await this.consentRepo.findAllByUser(userId);
    return consents.map((c) => this.toConsentDto(c));
  }

  async enforceConsent(userId: string): Promise<void> {
    const accepted = await this.hasAcceptedLatestTerms(userId);
    if (!accepted) {
      throw new ForbiddenException(
        'You must accept the latest Terms of Service to continue. Please review and accept the current terms.',
      );
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async sendPublishNotifications(doc: LegalDocument): Promise<void> {
    const { data } = await this.usersService.paginate({ page: 1, limit: 1000 });
    const emails = data
      .map((u) => u.email)
      .filter((e): e is string => !!e);

    await this.emailService.notifyNewTermsPublished(doc, emails);
  }

  private toDocumentDto(doc: LegalDocument): LegalDocumentResponseDto {
    return {
      id: doc.id,
      type: doc.type,
      version: doc.version,
      content: doc.content,
      title: doc.title,
      summary: doc.summary,
      status: doc.status,
      publishedAt: doc.publishedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private toConsentDto(consent: UserConsent): UserConsentResponseDto {
    return {
      id: consent.id,
      userId: consent.userId,
      documentId: consent.documentId,
      documentVersion: consent.documentVersion,
      ipAddress: consent.ipAddress,
      userAgent: consent.userAgent,
      acceptedAt: consent.acceptedAt,
    };
  }
}
