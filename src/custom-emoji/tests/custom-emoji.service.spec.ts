import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3StorageService } from '../../attachments/storage/s3-storage.service';
import { CustomEmojiRepository } from '../custom-emoji.repository';
import { CustomEmojiService } from '../custom-emoji.service';
import { CustomEmoji } from '../entities/custom-emoji.entity';
import { MAX_EMOJI_PER_GROUP } from '../dto/custom-emoji.dto';

const makeEmoji = (overrides: Partial<CustomEmoji> = {}): CustomEmoji =>
  ({
    id: 'emoji-1',
    groupId: 'group-1',
    uploadedBy: 'user-1',
    name: 'party_parrot',
    imageUrl: 'https://cdn.example.com/emoji/group-1/party_parrot.png',
    fileKey: 'emoji/group-1/party_parrot-uuid.png',
    usageCount: 0,
    isActive: true,
    uploader: null,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  } as CustomEmoji);

describe('CustomEmojiService', () => {
  let service: CustomEmojiService;
  let repo: jest.Mocked<CustomEmojiRepository>;
  let storage: jest.Mocked<S3StorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomEmojiService,
        {
          provide: CustomEmojiRepository,
          useValue: {
            findByGroup: jest.fn(),
            findByGroupAndName: jest.fn(),
            countByGroup: jest.fn(),
            searchByName: jest.fn(),
            incrementUsage: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: S3StorageService,
          useValue: {
            generateUploadUrl: jest.fn(),
            deleteFile: jest.fn(),
            resolveFileUrl: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CustomEmojiService);
    repo = module.get(CustomEmojiRepository) as jest.Mocked<CustomEmojiRepository>;
    storage = module.get(S3StorageService) as jest.Mocked<S3StorageService>;
  });

  afterEach(() => jest.clearAllMocks());

  // ─── generateUploadUrl ───────────────────────────────────────────────────────

  describe('generateUploadUrl', () => {
    const dto = { name: 'party_parrot', mimeType: 'image/png', fileSize: 10000 };

    it('returns presigned URL for admin', async () => {
      repo.findByGroupAndName.mockResolvedValue(null);
      repo.countByGroup.mockResolvedValue(0);
      storage.generateUploadUrl.mockResolvedValue('https://s3.example.com/presigned');

      const result = await service.generateUploadUrl('user-1', 'group-1', 'admin', dto);

      expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
      expect(result.fileKey).toMatch(/^emoji\/group-1\/party_parrot-/);
      expect(result.expiresIn).toBe(300);
    });

    it('returns presigned URL for moderator', async () => {
      repo.findByGroupAndName.mockResolvedValue(null);
      repo.countByGroup.mockResolvedValue(0);
      storage.generateUploadUrl.mockResolvedValue('https://s3.example.com/presigned');

      await expect(
        service.generateUploadUrl('user-1', 'group-1', 'moderator', dto),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException for non-admin', async () => {
      await expect(
        service.generateUploadUrl('user-1', 'group-1', 'member', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for invalid emoji name', async () => {
      await expect(
        service.generateUploadUrl('user-1', 'group-1', 'admin', {
          ...dto,
          name: 'Party Parrot!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for disallowed MIME type', async () => {
      repo.findByGroupAndName.mockResolvedValue(null);
      repo.countByGroup.mockResolvedValue(0);

      await expect(
        service.generateUploadUrl('user-1', 'group-1', 'admin', {
          ...dto,
          mimeType: 'image/jpeg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when name already exists in group', async () => {
      repo.findByGroupAndName.mockResolvedValue(makeEmoji());
      repo.countByGroup.mockResolvedValue(1);

      await expect(
        service.generateUploadUrl('user-1', 'group-1', 'admin', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it(`throws BadRequestException when group has ${MAX_EMOJI_PER_GROUP} emoji`, async () => {
      repo.findByGroupAndName.mockResolvedValue(null);
      repo.countByGroup.mockResolvedValue(MAX_EMOJI_PER_GROUP);

      await expect(
        service.generateUploadUrl('user-1', 'group-1', 'admin', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts GIF mime type', async () => {
      repo.findByGroupAndName.mockResolvedValue(null);
      repo.countByGroup.mockResolvedValue(0);
      storage.generateUploadUrl.mockResolvedValue('https://s3.example.com/presigned');

      const result = await service.generateUploadUrl('user-1', 'group-1', 'admin', {
        ...dto,
        mimeType: 'image/gif',
      });

      expect(result.fileKey).toMatch(/\.gif$/);
    });
  });

  // ─── confirmUpload ───────────────────────────────────────────────────────────

  describe('confirmUpload', () => {
    const dto = {
      name: 'party_parrot',
      fileKey: 'emoji/group-1/party_parrot-uuid.png',
      imageUrl: 'https://cdn.example.com/emoji/group-1/party_parrot.png',
    };

    it('creates and returns emoji record', async () => {
      repo.findByGroupAndName.mockResolvedValue(null);
      repo.countByGroup.mockResolvedValue(0);
      const emoji = makeEmoji();
      repo.create.mockReturnValue(emoji);
      repo.save.mockResolvedValue(emoji);

      const result = await service.confirmUpload('user-1', 'group-1', 'admin', dto);

      expect(result.name).toBe('party_parrot');
      expect(result.isActive).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws ForbiddenException for non-admin', async () => {
      await expect(
        service.confirmUpload('user-1', 'group-1', 'member', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enforces capacity at confirm time', async () => {
      repo.findByGroupAndName.mockResolvedValue(null);
      repo.countByGroup.mockResolvedValue(MAX_EMOJI_PER_GROUP);

      await expect(
        service.confirmUpload('user-1', 'group-1', 'admin', dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── deleteEmoji ─────────────────────────────────────────────────────────────

  describe('deleteEmoji', () => {
    it('deletes emoji and removes from storage', async () => {
      const emoji = makeEmoji();
      repo.findOne.mockResolvedValue(emoji);
      repo.remove.mockResolvedValue(emoji);
      storage.deleteFile.mockResolvedValue(undefined);

      await service.deleteEmoji('user-1', 'group-1', 'emoji-1', 'admin');

      expect(storage.deleteFile).toHaveBeenCalledWith(emoji.fileKey);
      expect(repo.remove).toHaveBeenCalledWith(emoji);
    });

    it('throws ForbiddenException for non-admin', async () => {
      await expect(
        service.deleteEmoji('user-1', 'group-1', 'emoji-1', 'member'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when emoji does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteEmoji('user-1', 'group-1', 'emoji-1', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('proceeds even if storage deletion fails (best-effort)', async () => {
      const emoji = makeEmoji();
      repo.findOne.mockResolvedValue(emoji);
      repo.remove.mockResolvedValue(emoji);
      storage.deleteFile.mockRejectedValue(new Error('S3 error'));

      await expect(
        service.deleteEmoji('user-1', 'group-1', 'emoji-1', 'admin'),
      ).resolves.toBeUndefined();
    });
  });

  // ─── getGroupEmoji ────────────────────────────────────────────────────────────

  describe('getGroupEmoji', () => {
    it('returns all active emoji for a group', async () => {
      repo.findByGroup.mockResolvedValue([makeEmoji(), makeEmoji({ id: 'emoji-2', name: 'wave' })]);

      const result = await service.getGroupEmoji('group-1');

      expect(result).toHaveLength(2);
      expect(result[0].groupId).toBe('group-1');
    });

    it('returns empty array when group has no emoji', async () => {
      repo.findByGroup.mockResolvedValue([]);
      const result = await service.getGroupEmoji('group-1');
      expect(result).toEqual([]);
    });
  });

  // ─── searchEmoji ─────────────────────────────────────────────────────────────

  describe('searchEmoji', () => {
    it('returns paginated search results', async () => {
      repo.searchByName.mockResolvedValue([[makeEmoji()], 1]);

      const result = await service.searchEmoji('party', 'group-1', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(repo.searchByName).toHaveBeenCalledWith('party', 'group-1', 1, 20);
    });

    it('searches globally when no groupId provided', async () => {
      repo.searchByName.mockResolvedValue([[makeEmoji()], 1]);

      await service.searchEmoji('party', undefined, 1, 20);

      expect(repo.searchByName).toHaveBeenCalledWith('party', undefined, 1, 20);
    });

    it('throws BadRequestException for empty query', async () => {
      await expect(service.searchEmoji('   ')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── incrementUsage ──────────────────────────────────────────────────────────

  describe('incrementUsage', () => {
    it('delegates to repository', async () => {
      repo.incrementUsage.mockResolvedValue(undefined);
      await service.incrementUsage('emoji-1');
      expect(repo.incrementUsage).toHaveBeenCalledWith('emoji-1');
    });
  });

  // ─── resolveEmojiTokens ──────────────────────────────────────────────────────

  describe('resolveEmojiTokens', () => {
    it('resolves :token: syntax to emoji metadata', async () => {
      repo.findByGroupAndName.mockImplementation((_gid, name) =>
        Promise.resolve(name === 'party_parrot' ? makeEmoji() : null),
      );

      const result = await service.resolveEmojiTokens(
        'Hello :party_parrot: and :unknown:',
        'group-1',
      );

      expect(result['party_parrot']).toBeDefined();
      expect(result['unknown']).toBeUndefined();
    });

    it('returns empty object when no tokens found', async () => {
      const result = await service.resolveEmojiTokens('Hello world', 'group-1');
      expect(result).toEqual({});
      expect(repo.findByGroupAndName).not.toHaveBeenCalled();
    });

    it('deduplicates repeated tokens', async () => {
      repo.findByGroupAndName.mockResolvedValue(makeEmoji());

      await service.resolveEmojiTokens(':party_parrot: :party_parrot: :party_parrot:', 'group-1');

      expect(repo.findByGroupAndName).toHaveBeenCalledTimes(1);
    });
  });

  // ─── validateEmojiName ───────────────────────────────────────────────────────

  describe('validateEmojiName', () => {
    it.each(['ab', 'hello_world', 'a1_b2', 'a'.repeat(32)])(
      'accepts valid name: %s',
      (name) => {
        expect(() => service.validateEmojiName(name)).not.toThrow();
      },
    );

    it.each(['a', 'a'.repeat(33), 'Hello', 'has space', 'has-dash', 'HAS_UPPER'])(
      'rejects invalid name: %s',
      (name) => {
        expect(() => service.validateEmojiName(name)).toThrow(BadRequestException);
      },
    );
  });
});
