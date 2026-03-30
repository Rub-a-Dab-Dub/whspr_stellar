import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LegalDocument, LegalDocumentType } from './entities/legal-document.entity';
import { UserConsent } from './entities/user-consent.entity';
import { LegalDocumentsRepository } from './legal-document.repository';
import { UserConsentsRepository } from './user-consent.repository';
import { CreateLegalDocumentDto, LegalDocumentResponseDto } from './dto/legal-document.dto';
import { UserConsentResponseDto } from './dto/user-consent.dto';
import { LegalEmailService } from './legal-email.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class LegalService {
  private readonly logger = new Logger(LegalService.name);

  constructor(
    private readonly documentRepo: LegalDocumentsRepository,
    private readonly consentRepo: UserConsentsRepository,
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
      effectiveDate: new Date(dto.effectiveDate),
      content: dto.content,
      isActive: false,
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

    if (doc.isActive) {
      throw new BadRequestException('Document is already published');
    }

    // Deactivate any currently active document of the same type
    await this.documentRepo.deactivateCurrent(doc.type);

    doc.isActive = true;

    const saved = await this.documentRepo.save(doc);
    this.logger.log(`Admin ${adminId} published ${saved.type} v${saved.version}`);

    // Fire-and-forget email notifications for Terms changes that require re-acceptance.
    if (saved.type === LegalDocumentType.TERMS) {
      this.sendPublishNotifications(saved).catch((err) =>
        this.logger.error('Failed to send publish notifications', err),
      );
    }

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
    type: LegalDocumentType,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<UserConsentResponseDto> {
    const doc = await this.documentRepo.findActive(type);
    if (!doc) {
      throw new NotFoundException(`No active ${type} document found`);
    }

    const consent = this.consentRepo.create({
      userId,
      documentId: doc.id,
      version: doc.version,
      ipAddress,
      userAgent,
    });

    const saved = await this.consentRepo.upsert(consent);
    return this.toConsentDto(saved);
  }

  async hasAcceptedCurrent(userId: string, type: LegalDocumentType = LegalDocumentType.TERMS): Promise<boolean> {
    const activeDoc = await this.documentRepo.findActive(type);
    if (!activeDoc) {
      // No active document for this type yet — no acceptance required.
      return true;
    }

    const consent = await this.consentRepo.findByUserAndDocument(userId, activeDoc.id);
    return !!consent;
  }

  async getConsentHistory(userId: string): Promise<UserConsentResponseDto[]> {
    const consents = await this.consentRepo.findAllByUser(userId);
    return consents.map((c) => this.toConsentDto(c));
  }

  async requireConsent(userId: string): Promise<void> {
    const accepted = await this.hasAcceptedCurrent(userId, LegalDocumentType.TERMS);
    if (!accepted) {
      throw new ForbiddenException(
        'You must accept the current Terms to continue.',
      );
    }
  }

  // Backward-compatible aliases used by existing callers/tests.
  async hasAcceptedLatestTerms(userId: string): Promise<boolean> {
    return this.hasAcceptedCurrent(userId, LegalDocumentType.TERMS);
  }

  async enforceConsent(userId: string): Promise<void> {
    return this.requireConsent(userId);
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
      effectiveDate: doc.effectiveDate,
      content: doc.content,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
    };
  }

  private toConsentDto(consent: UserConsent): UserConsentResponseDto {
    return {
      id: consent.id,
      userId: consent.userId,
      documentId: consent.documentId,
      version: consent.version,
      ipAddress: consent.ipAddress,
      userAgent: consent.userAgent,
      acceptedAt: consent.acceptedAt,
    };
  }
}
