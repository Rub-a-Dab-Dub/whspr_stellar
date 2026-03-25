import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'crypto';
import { AttachmentsRepository } from './attachments.repository';
import { PresignAttachmentDto } from './dto/presign-attachment.dto';
import { PresignAttachmentResponseDto } from './dto/presign-attachment-response.dto';
import { AttachmentResponseDto } from './dto/attachment-response.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { Attachment } from './entities/attachment.entity';
import { S3StorageService } from './storage/s3-storage.service';
import { VirusScanQueueService } from './virus-scan/virus-scan.queue.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UserTier } from '../users/entities/user.entity';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly attachmentsRepository: AttachmentsRepository,
    private readonly storageService: S3StorageService,
    private readonly virusScanQueueService: VirusScanQueueService,
    private readonly configService: ConfigService,
  ) {}

  async generateUploadUrl(
    user: UserResponseDto,
    dto: PresignAttachmentDto,
  ): Promise<PresignAttachmentResponseDto> {
    this.validateMimeType(dto.mimeType);
    this.validateFileSize(user.tier, dto.fileSize);

    const expiresIn = this.getPresignExpirySeconds();
    const fileKey = this.buildFileKey(user.id, dto.messageId, dto.fileName);
    const uploadUrl = await this.storageService.generateUploadUrl(fileKey, dto.mimeType, expiresIn);

    const expiresAtDate = new Date(Date.now() + expiresIn * 1000);

    return {
      uploadUrl,
      fileKey,
      fileUrl: this.storageService.resolveFileUrl(fileKey),
      expiresIn,
      expiresAt: expiresAtDate.toISOString(),
      maxAllowedFileSize: this.getMaxFileSizeForTier(user.tier),
    };
  }

  async createAttachment(
    uploaderId: string,
    dto: CreateAttachmentDto,
  ): Promise<AttachmentResponseDto> {
    this.validateMimeType(dto.mimeType);

    const attachment = this.attachmentsRepository.create({
      messageId: dto.messageId,
      uploaderId,
      fileKey: dto.fileKey,
      fileUrl: this.storageService.resolveFileUrl(dto.fileKey),
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
      width: dto.width ?? null,
      height: dto.height ?? null,
      duration: dto.duration ?? null,
    });

    const saved = await this.attachmentsRepository.save(attachment);

    this.virusScanQueueService
      .enqueueAttachmentScan({
        attachmentId: saved.id,
        fileKey: saved.fileKey,
        uploaderId: saved.uploaderId,
        messageId: saved.messageId,
      })
      .catch((error: unknown) => {
        this.logger.warn(`Failed to enqueue virus scan for attachment ${saved.id}: ${String(error)}`);
      });

    return this.toDto(saved);
  }

  async getAttachment(id: string): Promise<AttachmentResponseDto> {
    const attachment = await this.attachmentsRepository.findById(id);

    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${id} not found`);
    }

    return this.toDto(attachment);
  }

  async deleteAttachment(id: string, requesterId: string): Promise<void> {
    const attachment = await this.attachmentsRepository.findById(id);

    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${id} not found`);
    }

    if (attachment.uploaderId !== requesterId) {
      throw new ForbiddenException('You can only delete your own attachments');
    }

    await this.attachmentsRepository.remove(attachment);
    await this.storageService.deleteFile(attachment.fileKey);
  }

  private toDto(attachment: Attachment): AttachmentResponseDto {
    return plainToInstance(AttachmentResponseDto, attachment, {
      excludeExtraneousValues: true,
    });
  }

  private buildFileKey(uploaderId: string, messageId: string, fileName: string): string {
    const safeName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const now = Date.now();
    return `uploads/${uploaderId}/${messageId}/${now}-${randomUUID()}-${safeName}`;
  }

  private getPresignExpirySeconds(): number {
    const raw = this.configService.get<number>('ATTACHMENT_PRESIGN_EXPIRY_SECONDS', 300);
    if (!Number.isFinite(raw) || raw <= 0) {
      return 300;
    }
    return Math.floor(raw);
  }

  private getMaxFileSizeForTier(tier: UserTier): number {
    const defaults: Record<UserTier, number> = {
      [UserTier.FREE]: 10 * 1024 * 1024,
      [UserTier.PREMIUM]: 25 * 1024 * 1024,
      [UserTier.VIP]: 50 * 1024 * 1024,
    };

    const byTierConfig: Record<UserTier, number> = {
      [UserTier.FREE]: this.configService.get<number>('ATTACHMENT_MAX_SIZE_FREE_BYTES', defaults[UserTier.FREE]),
      [UserTier.PREMIUM]: this.configService.get<number>(
        'ATTACHMENT_MAX_SIZE_PREMIUM_BYTES',
        defaults[UserTier.PREMIUM],
      ),
      [UserTier.VIP]: this.configService.get<number>('ATTACHMENT_MAX_SIZE_VIP_BYTES', defaults[UserTier.VIP]),
    };

    const maxBytes = byTierConfig[tier] ?? defaults[UserTier.FREE];
    return Number.isFinite(maxBytes) && maxBytes > 0 ? Math.floor(maxBytes) : defaults[UserTier.FREE];
  }

  private validateFileSize(tier: UserTier, fileSize: number): void {
    const maxBytes = this.getMaxFileSizeForTier(tier);

    if (fileSize <= 0) {
      throw new BadRequestException('File size must be greater than 0 bytes');
    }

    if (fileSize > maxBytes) {
      throw new BadRequestException(
        `File size exceeds allowed limit for tier ${tier}. Max allowed: ${maxBytes} bytes`,
      );
    }
  }

  private validateMimeType(mimeType: string): void {
    const allowedMimeTypes = this.configService
      .get<string>(
        'ATTACHMENT_ALLOWED_MIME_TYPES',
        'image/jpeg,image/png,image/webp,image/gif,video/mp4,audio/mpeg,audio/wav,application/pdf',
      )
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x.length > 0);

    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      throw new BadRequestException(
        `Unsupported MIME type '${mimeType}'. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }
  }
}
