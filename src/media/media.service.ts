/**
 * MediaService — pre-signed upload generation, upload confirmation,
 * deletion, image resizing (Sharp) and thumbnail generation.
 *
 * Required packages (install before use):
 *   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp uuid
 *   npm install --save-dev @types/sharp
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

import { MediaType } from './enums/media-type.enum';
import { MEDIA_CONSTRAINTS, ResizeDimension } from './interfaces/media-constraints.interface';
import { PresignRequestDto } from './dto/presign-request.dto';
import { PresignResponseDto } from './dto/presign-response.dto';
import { ConfirmUploadResponseDto } from './dto/confirm-upload-response.dto';

// ---------------------------------------------------------------------------
// Simple in-memory async job queue (no external queue dependency needed)
// ---------------------------------------------------------------------------
interface ProcessingJob {
  key: string;
  mediaType: MediaType;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnBaseUrl: string;
  private readonly presignTtlSeconds = 900; // 15 min

  // In-memory queue — replace with Bull/BullMQ for production
  private readonly processingQueue: ProcessingJob[] = [];
  private isProcessing = false;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET', 'whspr-media');
    this.cdnBaseUrl = this.config.get<string>('CDN_BASE_URL', 'https://cdn.example.com');

    this.s3 = new S3Client({
      region: this.config.get<string>('S3_REGION', 'auto'),
      endpoint: this.config.get<string>('S3_ENDPOINT'), // omit for AWS; set for R2
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Validate MIME type & file size then generate a pre-signed PUT URL.
   */
  async generatePresignedUpload(dto: PresignRequestDto): Promise<PresignResponseDto> {
    const constraints = MEDIA_CONSTRAINTS[dto.mediaType];

    // Validate MIME type
    if (!constraints.allowedMimeTypes.includes(dto.mimeType)) {
      throw new BadRequestException(
        `MIME type "${dto.mimeType}" is not allowed for ${dto.mediaType}. ` +
          `Allowed: ${constraints.allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file size
    if (dto.fileSizeBytes > constraints.maxSizeBytes) {
      const maxMb = (constraints.maxSizeBytes / (1024 * 1024)).toFixed(0);
      throw new BadRequestException(
        `File size ${dto.fileSizeBytes} bytes exceeds the ${maxMb} MB limit for ${dto.mediaType}.`,
      );
    }

    const key = this.buildObjectKey(dto.mediaType, dto.fileName, dto.mimeType);
    const expiresAt = new Date(Date.now() + this.presignTtlSeconds * 1000);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.mimeType,
      ContentLength: dto.fileSizeBytes,
      Metadata: {
        mediaType: dto.mediaType,
        originalName: encodeURIComponent(dto.fileName),
      },
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: this.presignTtlSeconds,
    });

    return {
      key,
      uploadUrl,
      cdnUrl: this.buildCdnUrl(key),
      mediaType: dto.mediaType,
      expiresAt: expiresAt.toISOString(),
      contentType: dto.mimeType,
    };
  }

  /**
   * Confirm that the object exists in S3, then enqueue async processing.
   */
  async confirmUpload(key: string): Promise<ConfirmUploadResponseDto> {
    // Verify the object was actually uploaded
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      throw new NotFoundException(`Object "${key}" not found. Complete the upload first.`);
    }

    const mediaType = this.extractMediaType(key);
    const constraints = MEDIA_CONSTRAINTS[mediaType];

    // Build variant CDN URLs (sizes that will be generated async)
    const variantUrls = (constraints.resizeDimensions ?? []).map((dim) =>
      this.buildCdnUrl(this.buildVariantKey(key, dim.suffix)),
    );

    // Enqueue post-upload processing
    this.enqueue({ key, mediaType });

    return {
      key,
      cdnUrl: this.buildCdnUrl(key),
      mediaType,
      variantUrls,
      processingQueued: true,
    };
  }

  /**
   * Delete the original object and all its variants from S3.
   */
  async deleteMedia(key: string): Promise<void> {
    const mediaType = this.extractMediaType(key);
    const constraints = MEDIA_CONSTRAINTS[mediaType];

    const keysToDelete = [key, ...(constraints.resizeDimensions ?? []).map((d) => this.buildVariantKey(key, d.suffix))];

    await Promise.all(
      keysToDelete.map((k) =>
        this.s3
          .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: k }))
          .catch((err) => this.logger.warn(`Failed to delete ${k}: ${err.message}`)),
      ),
    );
  }

  /**
   * Download, resize to the given dimensions, and re-upload as a variant.
   */
  async resizeImage(key: string, width: number, height: number, suffix: string): Promise<string> {
    const sourceBuffer = await this.downloadObject(key);

    const resized = await sharp(sourceBuffer)
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .toBuffer();

    const variantKey = this.buildVariantKey(key, suffix);
    const contentType = this.detectImageMimeType(key);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: variantKey,
        Body: resized,
        ContentType: contentType,
      }),
    );

    this.logger.log(`Resized ${key} → ${variantKey} (${width}×${height})`);
    return this.buildCdnUrl(variantKey);
  }

  /**
   * Generate a square thumbnail (128×128 JPEG) for an image object.
   */
  async generateThumbnail(key: string): Promise<string> {
    const sourceBuffer = await this.downloadObject(key);

    const thumbnail = await sharp(sourceBuffer)
      .resize(128, 128, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 75 })
      .toBuffer();

    const thumbKey = this.buildVariantKey(key, 'thumb');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: thumbKey,
        Body: thumbnail,
        ContentType: 'image/jpeg',
      }),
    );

    this.logger.log(`Thumbnail generated: ${thumbKey}`);
    return this.buildCdnUrl(thumbKey);
  }

  // -------------------------------------------------------------------------
  // Queue helpers
  // -------------------------------------------------------------------------

  private enqueue(job: ProcessingJob): void {
    this.processingQueue.push(job);
    if (!this.isProcessing) {
      // Drain asynchronously so the HTTP response is returned immediately
      setImmediate(() => this.drainQueue());
    }
  }

  private async drainQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const job = this.processingQueue.shift()!;
      await this.processJob(job).catch((err) =>
        this.logger.error(`Processing failed for ${job.key}: ${err.message}`, err.stack),
      );
    }

    this.isProcessing = false;
  }

  private async processJob(job: ProcessingJob): Promise<void> {
    const constraints = MEDIA_CONSTRAINTS[job.mediaType];

    // Resize all configured dimensions
    if (constraints.resizeDimensions?.length) {
      for (const dim of constraints.resizeDimensions) {
        await this.resizeImage(job.key, dim.width, dim.height, dim.suffix);
      }
    }

    // Generate thumbnail where required
    if (constraints.generateThumbnail) {
      await this.generateThumbnail(job.key);
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildObjectKey(mediaType: MediaType, fileName: string, mimeType: string): string {
    const ext = this.extensionForMime(mimeType) ?? this.extractExtension(fileName);
    return `${mediaType}/${uuidv4()}${ext}`;
  }

  private buildVariantKey(originalKey: string, suffix: string): string {
    const dotIdx = originalKey.lastIndexOf('.');
    if (dotIdx === -1) return `${originalKey}_${suffix}`;
    return `${originalKey.slice(0, dotIdx)}_${suffix}${originalKey.slice(dotIdx)}`;
  }

  private buildCdnUrl(key: string): string {
    return `${this.cdnBaseUrl}/${key}`;
  }

  private extractMediaType(key: string): MediaType {
    const prefix = key.split('/')[0] as MediaType;
    if (!Object.values(MediaType).includes(prefix)) {
      throw new BadRequestException(`Cannot determine media type from key "${key}".`);
    }
    return prefix;
  }

  private async downloadObject(key: string): Promise<Buffer> {
    let response: { Body?: unknown };
    try {
      response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      throw new NotFoundException(`Object "${key}" not found in storage.`);
    }

    if (!response.Body) {
      throw new InternalServerErrorException(`Empty body for object "${key}".`);
    }

    return this.streamToBuffer(response.Body as Readable);
  }

  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  private extensionForMime(mime: string): string | null {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/pdf': '.pdf',
    };
    return map[mime] ?? null;
  }

  private extractExtension(fileName: string): string {
    const idx = fileName.lastIndexOf('.');
    return idx !== -1 ? fileName.slice(idx) : '';
  }

  private detectImageMimeType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    return map[ext ?? ''] ?? 'application/octet-stream';
  }
}
