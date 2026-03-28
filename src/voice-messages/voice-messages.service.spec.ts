import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserTier } from '../users/entities/user.entity';
import { S3StorageService } from '../attachments/storage/s3-storage.service';
import { VoiceMessageRepository } from './voice-message.repository';
import { WaveformQueueService } from './waveform-queue.service';
import { VoiceMessagesService } from './voice-messages.service';
import {
  MAX_DURATION_ELEVATED,
  MAX_DURATION_STANDARD,
} from './dto/voice-message.dto';

const mockUser = (tier = UserTier.SILVER) => ({
  id: 'user-uuid',
  walletAddress: '0xabc',
  tier,
  isActive: true,
  email: null,
  username: null,
  displayName: null,
  avatarUrl: null,
  bio: null,
  preferredLocale: null,
  referralCode: null,
  isVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockVm = (overrides = {}) => ({
  id: 'vm-uuid',
  messageId: 'msg-uuid',
  uploaderId: 'user-uuid',
  fileKey: 'voice/user-uuid/msg-uuid/123.ogg',
  fileUrl: 'https://cdn.example.com/voice/user-uuid/msg-uuid/123.ogg',
  duration: 30,
  waveformData: null,
  mimeType: 'audio/ogg',
  fileSize: 51200,
  confirmed: true,
  createdAt: new Date(),
  ...overrides,
});

describe('VoiceMessagesService', () => {
  let service: VoiceMessagesService;
  let repo: jest.Mocked<VoiceMessageRepository>;
  let storage: jest.Mocked<S3StorageService>;
  let waveformQueue: jest.Mocked<WaveformQueueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceMessagesService,
        {
          provide: VoiceMessageRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findById: jest.fn(),
            findByFileKey: jest.fn(),
            findByMessageId: jest.fn(),
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
          provide: WaveformQueueService,
          useValue: { enqueue: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(VoiceMessagesService);
    repo = module.get(VoiceMessageRepository);
    storage = module.get(S3StorageService);
    waveformQueue = module.get(WaveformQueueService);
  });

  // ── presign ────────────────────────────────────────────────────────────────

  describe('presign', () => {
    it('returns presign response for valid input', async () => {
      storage.generateUploadUrl.mockResolvedValue('https://s3.example.com/presigned');
      storage.resolveFileUrl.mockReturnValue('https://cdn.example.com/voice/key.ogg');

      const result = await service.presign(mockUser() as any, {
        messageId: 'msg-uuid',
        mimeType: 'audio/ogg',
        fileSize: 51200,
        duration: 30,
      });

      expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
      expect(result.expiresIn).toBe(300);
      expect(result.fileKey).toContain('voice/');
    });

    it('throws BadRequestException for invalid MIME type', async () => {
      await expect(
        service.presign(mockUser() as any, {
          messageId: 'msg-uuid',
          mimeType: 'audio/mpeg',
          fileSize: 51200,
          duration: 30,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when SILVER user exceeds 5-min limit', async () => {
      await expect(
        service.presign(mockUser(UserTier.SILVER) as any, {
          messageId: 'msg-uuid',
          mimeType: 'audio/ogg',
          fileSize: 51200,
          duration: MAX_DURATION_STANDARD + 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows GOLD user up to 10-min limit', async () => {
      storage.generateUploadUrl.mockResolvedValue('https://s3.example.com/presigned');
      storage.resolveFileUrl.mockReturnValue('https://cdn.example.com/key.ogg');

      await expect(
        service.presign(mockUser(UserTier.GOLD) as any, {
          messageId: 'msg-uuid',
          mimeType: 'audio/ogg',
          fileSize: 51200,
          duration: MAX_DURATION_ELEVATED,
        }),
      ).resolves.not.toThrow();
    });

    it('throws BadRequestException when GOLD user exceeds 10-min limit', async () => {
      await expect(
        service.presign(mockUser(UserTier.GOLD) as any, {
          messageId: 'msg-uuid',
          mimeType: 'audio/ogg',
          fileSize: 51200,
          duration: MAX_DURATION_ELEVATED + 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts all three allowed MIME types', async () => {
      storage.generateUploadUrl.mockResolvedValue('https://s3.example.com/presigned');
      storage.resolveFileUrl.mockReturnValue('https://cdn.example.com/key');

      for (const mime of ['audio/ogg', 'audio/mp4', 'audio/webm']) {
        await expect(
          service.presign(mockUser() as any, {
            messageId: 'msg-uuid',
            mimeType: mime,
            fileSize: 51200,
            duration: 30,
          }),
        ).resolves.not.toThrow();
      }
    });
  });

  // ── confirm ────────────────────────────────────────────────────────────────

  describe('confirm', () => {
    it('creates and returns a confirmed voice message', async () => {
      const vm = mockVm({ confirmed: false });
      repo.findByFileKey.mockResolvedValue(null);
      repo.create.mockReturnValue(vm as any);
      repo.save.mockResolvedValue({ ...vm, confirmed: true } as any);
      storage.resolveFileUrl.mockReturnValue(vm.fileUrl);

      const result = await service.confirm(mockUser() as any, 'msg-uuid', {
        fileKey: 'voice/user-uuid/msg-uuid/123.ogg',
        fileSize: 51200,
        duration: 30,
      });

      expect(result.confirmed).toBe(true);
      expect(repo.save).toHaveBeenCalled();
      await new Promise((r) => setTimeout(r, 10));
      expect(waveformQueue.enqueue).toHaveBeenCalled();
    });

    it('returns existing confirmed record idempotently', async () => {
      repo.findByFileKey.mockResolvedValue(mockVm() as any);

      const result = await service.confirm(mockUser() as any, 'msg-uuid', {
        fileKey: 'voice/user-uuid/msg-uuid/123.ogg',
        fileSize: 51200,
        duration: 30,
      });

      expect(result.confirmed).toBe(true);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when fileKey belongs to another user', async () => {
      repo.findByFileKey.mockResolvedValue(mockVm({ uploaderId: 'other-user' }) as any);

      await expect(
        service.confirm(mockUser() as any, 'msg-uuid', {
          fileKey: 'voice/user-uuid/msg-uuid/123.ogg',
          fileSize: 51200,
          duration: 30,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for invalid MIME type in fileKey', async () => {
      repo.findByFileKey.mockResolvedValue(null);

      await expect(
        service.confirm(mockUser() as any, 'msg-uuid', {
          fileKey: 'voice/user-uuid/msg-uuid/123.mp3',
          fileSize: 51200,
          duration: 30,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns voice message DTO', async () => {
      repo.findById.mockResolvedValue(mockVm() as any);
      const result = await service.findById('vm-uuid');
      expect(result.id).toBe('vm-uuid');
    });

    it('throws NotFoundException for unknown id', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findByMessageId ────────────────────────────────────────────────────────

  describe('findByMessageId', () => {
    it('returns list of confirmed voice messages', async () => {
      repo.findByMessageId.mockResolvedValue([mockVm() as any]);
      const result = await service.findByMessageId('msg-uuid');
      expect(result).toHaveLength(1);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes voice message and removes from storage', async () => {
      repo.findById.mockResolvedValue(mockVm() as any);
      repo.remove.mockResolvedValue(undefined);
      storage.deleteFile.mockResolvedValue(undefined);

      await service.delete('vm-uuid', 'user-uuid');

      expect(repo.remove).toHaveBeenCalled();
      expect(storage.deleteFile).toHaveBeenCalledWith('voice/user-uuid/msg-uuid/123.ogg');
    });

    it('throws NotFoundException for unknown id', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete('bad-id', 'user-uuid')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when requester is not the owner', async () => {
      repo.findById.mockResolvedValue(mockVm() as any);
      await expect(service.delete('vm-uuid', 'other-user')).rejects.toThrow(ForbiddenException);
    });
  });
});
