/**
 * Unit tests for MediaService — S3 client and Sharp are fully mocked.
 *
 * Run: npx jest src/media/media.service.spec.ts --coverage
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock @aws-sdk/client-s3 before importing the service
// ---------------------------------------------------------------------------
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    HeadObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

// Mock pre-signed URL generation
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-put-url'),
}));

// Mock Sharp
const mockSharpInstance = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-image-data')),
};
jest.mock('sharp', () => jest.fn().mockReturnValue(mockSharpInstance));

// Mock uuid
jest.mock('uuid', () => ({ v4: jest.fn().mockReturnValue('test-uuid-1234') }));

// ---------------------------------------------------------------------------
// Import service AFTER mocks are set up
// ---------------------------------------------------------------------------
import { MediaService } from './media.service';
import { MediaType } from './enums/media-type.enum';
import { MEDIA_CONSTRAINTS } from './interfaces/media-constraints.interface';
import { Readable } from 'stream';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeReadable(data: string): Readable {
  const stream = new Readable();
  stream.push(data);
  stream.push(null);
  return stream;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MediaService', () => {
  let service: MediaService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              const vals: Record<string, string> = {
                S3_BUCKET: 'test-bucket',
                CDN_BASE_URL: 'https://cdn.test.com',
                S3_REGION: 'auto',
                S3_ACCESS_KEY_ID: 'test-key',
                S3_SECRET_ACCESS_KEY: 'test-secret',
              };
              return vals[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // generatePresignedUpload
  // -------------------------------------------------------------------------
  describe('generatePresignedUpload', () => {
    it('returns a presign response for a valid avatar upload', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.example.com/signed');

      const result = await service.generatePresignedUpload({
        mediaType: MediaType.AVATAR,
        mimeType: 'image/jpeg',
        fileSizeBytes: 1024 * 100, // 100 KB
        fileName: 'avatar.jpg',
      });

      expect(result.key).toContain('avatar/');
      expect(result.uploadUrl).toBe('https://s3.example.com/signed');
      expect(result.cdnUrl).toMatch(/^https:\/\/cdn\.test\.com\/avatar\//);
      expect(result.mediaType).toBe(MediaType.AVATAR);
      expect(result.contentType).toBe('image/jpeg');
      expect(result.expiresAt).toBeDefined();
    });

    it('returns a presign response for a banner upload', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.example.com/banner-signed');

      const result = await service.generatePresignedUpload({
        mediaType: MediaType.BANNER,
        mimeType: 'image/png',
        fileSizeBytes: 2 * 1024 * 1024,
        fileName: 'banner.png',
      });

      expect(result.key).toContain('banner/');
      expect(result.cdnUrl).toMatch(/^https:\/\/cdn\.test\.com\/banner\//);
    });

    it('throws BadRequestException for disallowed MIME type', async () => {
      await expect(
        service.generatePresignedUpload({
          mediaType: MediaType.AVATAR,
          mimeType: 'image/gif', // not allowed for AVATAR
          fileSizeBytes: 500,
          fileName: 'anim.gif',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file size exceeds limit', async () => {
      const constraints = MEDIA_CONSTRAINTS[MediaType.AVATAR];
      await expect(
        service.generatePresignedUpload({
          mediaType: MediaType.AVATAR,
          mimeType: 'image/jpeg',
          fileSizeBytes: constraints.maxSizeBytes + 1,
          fileName: 'too-big.jpg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows PDFs for MESSAGE_ATTACHMENT', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.example.com/pdf-signed');

      const result = await service.generatePresignedUpload({
        mediaType: MediaType.MESSAGE_ATTACHMENT,
        mimeType: 'application/pdf',
        fileSizeBytes: 1024 * 1024,
        fileName: 'doc.pdf',
      });

      expect(result.key).toContain('message_attachment/');
    });

    it('throws for disallowed MIME type on GROUP_AVATAR', async () => {
      await expect(
        service.generatePresignedUpload({
          mediaType: MediaType.GROUP_AVATAR,
          mimeType: 'video/mp4',
          fileSizeBytes: 1024,
          fileName: 'video.mp4',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // confirmUpload
  // -------------------------------------------------------------------------
  describe('confirmUpload', () => {
    it('confirms upload and returns variant URLs for avatar', async () => {
      mockSend.mockResolvedValue({}); // HeadObjectCommand succeeds

      const result = await service.confirmUpload('avatar/test-uuid-1234.jpg');

      expect(result.key).toBe('avatar/test-uuid-1234.jpg');
      expect(result.cdnUrl).toBe('https://cdn.test.com/avatar/test-uuid-1234.jpg');
      expect(result.mediaType).toBe(MediaType.AVATAR);
      expect(result.variantUrls.length).toBeGreaterThan(0); // 256 + 64 variants
      expect(result.processingQueued).toBe(true);
    });

    it('throws NotFoundException when object does not exist in S3', async () => {
      mockSend.mockRejectedValue({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });

      await expect(service.confirmUpload('avatar/missing.jpg')).rejects.toThrow(NotFoundException);
    });

    it('returns empty variantUrls for MESSAGE_ATTACHMENT', async () => {
      mockSend.mockResolvedValue({});

      const result = await service.confirmUpload('message_attachment/test-uuid-1234.pdf');

      expect(result.variantUrls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // deleteMedia
  // -------------------------------------------------------------------------
  describe('deleteMedia', () => {
    it('deletes original and all variants for an avatar', async () => {
      mockSend.mockResolvedValue({});

      await service.deleteMedia('avatar/test-uuid-1234.jpg');

      // AVATAR has 2 resize dimensions → 1 original + 2 variants = 3 delete calls
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('deletes only the original for MESSAGE_ATTACHMENT', async () => {
      mockSend.mockResolvedValue({});

      await service.deleteMedia('message_attachment/test-uuid-1234.pdf');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('does not throw when S3 delete fails (logs warning instead)', async () => {
      mockSend.mockRejectedValue(new Error('Access denied'));

      await expect(service.deleteMedia('avatar/test-uuid-1234.jpg')).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // resizeImage
  // -------------------------------------------------------------------------
  describe('resizeImage', () => {
    it('downloads, resizes with Sharp and uploads variant', async () => {
      const fakeStream = makeReadable('fake-image-bytes');
      mockSend
        .mockResolvedValueOnce({ Body: fakeStream }) // GetObjectCommand
        .mockResolvedValueOnce({}); // PutObjectCommand (variant)

      const variantUrl = await service.resizeImage('avatar/test-uuid-1234.jpg', 256, 256, '256');

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(256, 256, expect.any(Object));
      expect(variantUrl).toContain('_256.jpg');
      expect(variantUrl).toMatch(/^https:\/\/cdn\.test\.com\//);
    });

    it('throws NotFoundException when source object is missing', async () => {
      mockSend.mockRejectedValue({ name: 'NoSuchKey' });

      await expect(service.resizeImage('avatar/missing.jpg', 256, 256, '256')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // generateThumbnail
  // -------------------------------------------------------------------------
  describe('generateThumbnail', () => {
    it('generates a 128×128 JPEG thumbnail and returns CDN URL', async () => {
      const fakeStream = makeReadable('fake-image-bytes');
      mockSend
        .mockResolvedValueOnce({ Body: fakeStream })
        .mockResolvedValueOnce({});

      const thumbUrl = await service.generateThumbnail('avatar/test-uuid-1234.jpg');

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(128, 128, expect.any(Object));
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 75 });
      expect(thumbUrl).toContain('_thumb.jpg');
    });

    it('throws NotFoundException when source object is missing', async () => {
      mockSend.mockRejectedValue({ name: 'NoSuchKey' });

      await expect(service.generateThumbnail('avatar/missing.jpg')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // CDN URL construction
  // -------------------------------------------------------------------------
  describe('CDN URL construction', () => {
    it('CDN URLs use the configured CDN_BASE_URL', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.example.com/signed');

      const result = await service.generatePresignedUpload({
        mediaType: MediaType.BANNER,
        mimeType: 'image/webp',
        fileSizeBytes: 1024,
        fileName: 'hero.webp',
      });

      expect(result.cdnUrl).toMatch(/^https:\/\/cdn\.test\.com\//);
    });
  });
});
