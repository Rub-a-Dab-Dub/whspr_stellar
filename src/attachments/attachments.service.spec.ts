import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentsService } from './attachments.service';
import { AttachmentsRepository } from './attachments.repository';
import { S3StorageService } from './storage/s3-storage.service';
import { VirusScanQueueService } from './virus-scan/virus-scan.queue.service';
import { UserTier } from '../users/entities/user.entity';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { Attachment } from './entities/attachment.entity';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let repo: jest.Mocked<AttachmentsRepository>;
  let storage: jest.Mocked<S3StorageService>;
  let virusQueue: jest.Mocked<VirusScanQueueService>;

  const user: UserResponseDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'u1',
    walletAddress: '0x123',
    email: null,
    displayName: null,
    avatarUrl: null,
    bio: null,
    tier: UserTier.FREE,
    isActive: true,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const attachment: Attachment = {
    id: '123e4567-e89b-12d3-a456-426614174111',
    messageId: '123e4567-e89b-12d3-a456-426614174222',
    uploaderId: user.id,
    fileUrl: 'https://cdn.example.com/uploads/a.jpg',
    fileKey: 'uploads/a.jpg',
    fileName: 'a.jpg',
    fileSize: 1000,
    mimeType: 'image/jpeg',
    width: 100,
    height: 100,
    duration: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        {
          provide: AttachmentsRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findById: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: S3StorageService,
          useValue: {
            generateUploadUrl: jest.fn(),
            resolveFileUrl: jest.fn(),
            deleteFile: jest.fn(),
          },
        },
        {
          provide: VirusScanQueueService,
          useValue: {
            enqueueAttachmentScan: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const values: Record<string, unknown> = {
                ATTACHMENT_ALLOWED_MIME_TYPES: 'image/jpeg,image/png,video/mp4',
                ATTACHMENT_PRESIGN_EXPIRY_SECONDS: 300,
                ATTACHMENT_MAX_SIZE_FREE_BYTES: 10 * 1024 * 1024,
                ATTACHMENT_MAX_SIZE_PREMIUM_BYTES: 25 * 1024 * 1024,
                ATTACHMENT_MAX_SIZE_VIP_BYTES: 50 * 1024 * 1024,
              };
              return values[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AttachmentsService);
    repo = module.get(AttachmentsRepository);
    storage = module.get(S3StorageService);
    virusQueue = module.get(VirusScanQueueService);
  });

  describe('generateUploadUrl', () => {
    it('generates a presigned URL with 5-minute expiry', async () => {
      storage.generateUploadUrl.mockResolvedValue('https://signed-url');
      storage.resolveFileUrl.mockReturnValue('https://cdn.example.com/uploads/key');

      const result = await service.generateUploadUrl(user, {
        messageId: '123e4567-e89b-12d3-a456-426614174333',
        fileName: 'pic.jpg',
        fileSize: 1000,
        mimeType: 'image/jpeg',
      });

      expect(result.uploadUrl).toBe('https://signed-url');
      expect(result.expiresIn).toBe(300);
      expect(result.fileKey).toContain('uploads/');
      expect(storage.generateUploadUrl).toHaveBeenCalledWith(
        expect.stringContaining('uploads/'),
        'image/jpeg',
        300,
      );
    });

    it('rejects invalid MIME type at presign time', async () => {
      await expect(
        service.generateUploadUrl(user, {
          messageId: '123e4567-e89b-12d3-a456-426614174333',
          fileName: 'malware.exe',
          fileSize: 1000,
          mimeType: 'application/x-msdownload',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects oversized files based on tier limit', async () => {
      await expect(
        service.generateUploadUrl(user, {
          messageId: '123e4567-e89b-12d3-a456-426614174333',
          fileName: 'big.mp4',
          fileSize: 12 * 1024 * 1024,
          mimeType: 'video/mp4',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createAttachment', () => {
    it('saves attachment and queues asynchronous virus scan', async () => {
      repo.create.mockReturnValue(attachment);
      repo.save.mockResolvedValue(attachment);
      storage.resolveFileUrl.mockReturnValue(attachment.fileUrl);

      const result = await service.createAttachment(user.id, {
        messageId: attachment.messageId,
        fileKey: attachment.fileKey,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        width: attachment.width ?? undefined,
        height: attachment.height ?? undefined,
      });

      expect(result.id).toBe(attachment.id);
      expect(virusQueue.enqueueAttachmentScan).toHaveBeenCalledWith({
        attachmentId: attachment.id,
        fileKey: attachment.fileKey,
        uploaderId: attachment.uploaderId,
        messageId: attachment.messageId,
      });
    });
  });

  describe('getAttachment', () => {
    it('returns attachment when found', async () => {
      repo.findById.mockResolvedValue(attachment);
      const result = await service.getAttachment(attachment.id);
      expect(result.id).toBe(attachment.id);
    });

    it('throws NotFoundException when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getAttachment('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAttachment', () => {
    it('deletes attachment and file when owned by requester', async () => {
      repo.findById.mockResolvedValue(attachment);
      repo.remove.mockResolvedValue(attachment);
      storage.deleteFile.mockResolvedValue(undefined);

      await service.deleteAttachment(attachment.id, attachment.uploaderId);

      expect(repo.remove).toHaveBeenCalledWith(attachment);
      expect(storage.deleteFile).toHaveBeenCalledWith(attachment.fileKey);
    });

    it('throws ForbiddenException when requester is not uploader', async () => {
      repo.findById.mockResolvedValue(attachment);
      await expect(service.deleteAttachment(attachment.id, 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
