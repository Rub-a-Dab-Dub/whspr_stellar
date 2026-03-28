import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UserTier } from '../users/entities/user.entity';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { S3StorageService } from '../attachments/storage/s3-storage.service';
import { VoiceMessageRepository } from './voice-message.repository';
import { WaveformQueueService } from './waveform-queue.service';
import { VoiceMessage } from './entities/voice-message.entity';
import {
  ALLOWED_VOICE_MIME_TYPES,
  ConfirmVoiceMessageDto,
  MAX_DURATION_ELEVATED,
  MAX_DURATION_STANDARD,
  PRESIGN_EXPIRY_SECONDS,
  PresignVoiceMessageDto,
  PresignVoiceMessageResponseDto,
  VoiceMessageResponseDto,
} from './dto/voice-message.dto';

/** Elevated tiers get the extended 10-minute limit. */
const ELEVATED_TIERS: UserTier[] = [UserTier.GOLD, UserTier.BLACK];

@Injectable()
export class VoiceMessagesService {
  private readonly logger = new Logger(VoiceMessagesService.name);

  constructor(
    private readonly repo: VoiceMessageRepository,
    private readonly storage: S3StorageService,
    private readonly waveformQueue: WaveformQueueService,
  ) {}

  // ── Presign ────────────────────────────────────────────────────────────────

  async presign(
    user: UserResponseDto,
    dto: PresignVoiceMessageDto,
  ): Promise<PresignVoiceMessageResponseDto> {
    this.validateMimeType(dto.mimeType);
    this.validateDuration(user.tier, dto.duration);

    const fileKey = this.buildFileKey(user.id, dto.messageId, dto.mimeType);
    const uploadUrl = await this.storage.generateUploadUrl(
      fileKey,
      dto.mimeType,
      PRESIGN_EXPIRY_SECONDS,
    );

    const expiresAt = new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000);

    return {
      uploadUrl,
      fileKey,
      fileUrl: this.storage.resolveFileUrl(fileKey),
      expiresIn: PRESIGN_EXPIRY_SECONDS,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // ── Confirm ────────────────────────────────────────────────────────────────

  async confirm(
    user: UserResponseDto,
    messageId: string,
    dto: ConfirmVoiceMessageDto,
  ): Promise<VoiceMessageResponseDto> {
    this.validateMimeType(this.mimeTypeFromKey(dto.fileKey));
    this.validateDuration(user.tier, dto.duration);

    const existing = await this.repo.findByFileKey(dto.fileKey);
    if (existing) {
      if (existing.uploaderId !== user.id) {
        throw new ForbiddenException('This file key belongs to another user');
      }
      if (existing.confirmed) {
        return this.toDto(existing);
      }
      existing.confirmed = true;
      existing.duration = dto.duration;
      existing.fileSize = dto.fileSize;
      const saved = await this.repo.save(existing);
      this.enqueueWaveform(saved);
      return this.toDto(saved);
    }

    const vm = this.repo.create({
      messageId,
      uploaderId: user.id,
      fileKey: dto.fileKey,
      fileUrl: this.storage.resolveFileUrl(dto.fileKey),
      mimeType: this.mimeTypeFromKey(dto.fileKey),
      fileSize: dto.fileSize,
      duration: dto.duration,
      waveformData: null,
      confirmed: true,
    });

    const saved = await this.repo.save(vm);
    this.enqueueWaveform(saved);
    this.logger.log(`Voice message confirmed: ${saved.id} by user ${user.id}`);
    return this.toDto(saved);
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<VoiceMessageResponseDto> {
    const vm = await this.repo.findById(id);
    if (!vm) throw new NotFoundException(`Voice message ${id} not found`);
    return this.toDto(vm);
  }

  async findByMessageId(messageId: string): Promise<VoiceMessageResponseDto[]> {
    const vms = await this.repo.findByMessageId(messageId);
    return vms.map((v) => this.toDto(v));
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async delete(id: string, requesterId: string): Promise<void> {
    const vm = await this.repo.findById(id);
    if (!vm) throw new NotFoundException(`Voice message ${id} not found`);
    if (vm.uploaderId !== requesterId) {
      throw new ForbiddenException('You can only delete your own voice messages');
    }
    await this.repo.remove(vm);
    await this.storage.deleteFile(vm.fileKey);
    this.logger.log(`Voice message deleted: ${id}`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private validateMimeType(mimeType: string): void {
    if (!(ALLOWED_VOICE_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase())) {
      throw new BadRequestException(
        `Unsupported MIME type '${mimeType}'. Allowed: ${ALLOWED_VOICE_MIME_TYPES.join(', ')}`,
      );
    }
  }

  private validateDuration(tier: UserTier, duration: number): void {
    const max = ELEVATED_TIERS.includes(tier) ? MAX_DURATION_ELEVATED : MAX_DURATION_STANDARD;
    if (duration > max) {
      throw new BadRequestException(
        `Duration ${duration}s exceeds the ${max}s limit for your account tier`,
      );
    }
  }

  private buildFileKey(userId: string, messageId: string, mimeType: string): string {
    const ext = mimeType.split('/')[1] ?? 'ogg';
    return `voice/${userId}/${messageId}/${Date.now()}-${randomUUID()}.${ext}`;
  }

  /** Best-effort MIME type extraction from file key extension. */
  private mimeTypeFromKey(fileKey: string): string {
    const ext = fileKey.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      ogg: 'audio/ogg',
      mp4: 'audio/mp4',
      m4a: 'audio/mp4',
      webm: 'audio/webm',
    };
    return map[ext] ?? 'audio/ogg';
  }

  private enqueueWaveform(vm: VoiceMessage): void {
    this.waveformQueue
      .enqueue({ voiceMessageId: vm.id, fileKey: vm.fileKey })
      .catch((err) => this.logger.error('Failed to enqueue waveform job', err));
  }

  private toDto(vm: VoiceMessage): VoiceMessageResponseDto {
    return {
      id: vm.id,
      messageId: vm.messageId,
      uploaderId: vm.uploaderId,
      fileKey: vm.fileKey,
      fileUrl: vm.fileUrl,
      duration: vm.duration,
      waveformData: vm.waveformData,
      mimeType: vm.mimeType,
      fileSize: vm.fileSize,
      confirmed: vm.confirmed,
      createdAt: vm.createdAt,
    };
  }
}
