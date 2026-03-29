import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationQueueService } from '../ai-moderation/queue/moderation.queue';
import { S3StorageService } from '../attachments/storage/s3-storage.service';
import { UserTier } from '../users/entities/user.entity';
import { UsersRepository } from '../users/users.repository';
import { UserStickerPackDownload } from './entities/user-sticker-pack-download.entity';
import { UserStickerPack } from './entities/user-sticker-pack.entity';
import { UserSticker } from './entities/user-sticker.entity';
import { StickerWebpService } from './sticker-webp.service';
import { UserStickerPackService } from './user-sticker-pack.service';
import {
  MAX_STICKERS_PER_UGC_PACK,
  MAX_STICKER_UPLOAD_BYTES,
  MAX_UGC_PACKS_GOLD_BLACK,
  MAX_UGC_PACKS_SILVER,
} from './user-sticker-packs.constants';

describe('UserStickerPackService', () => {
  let service: UserStickerPackService;
  let packs: jest.Mocked<Repository<UserStickerPack>>;
  let stickers: jest.Mocked<Repository<UserSticker>>;
  let downloads: jest.Mocked<Repository<UserStickerPackDownload>>;
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findOne'>>;
  let s3: jest.Mocked<
    Pick<S3StorageService, 'getObjectBuffer' | 'putObjectBuffer' | 'resolveFileUrl' | 'deleteFile'>
  >;
  let webp: jest.Mocked<Pick<StickerWebpService, 'toWebp'>>;
  let moderation: jest.Mocked<Pick<ModerationQueueService, 'enqueueImageModeration'>>;

  const creatorId = '11111111-1111-1111-1111-111111111111';
  const otherId = '22222222-2222-2222-2222-222222222222';
  const packId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const stickerId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  function mockPack(overrides: Partial<UserStickerPack> = {}): UserStickerPack {
    return {
      id: packId,
      creatorId,
      name: 'Pack',
      description: null,
      coverUrl: null,
      isPublished: false,
      isApproved: false,
      downloadCount: 0,
      price: '0.00',
      createdAt: new Date(),
      updatedAt: new Date(),
      stickers: [],
      ...overrides,
    } as UserStickerPack;
  }

  function mockSticker(overrides: Partial<UserSticker> = {}): UserSticker {
    return {
      id: stickerId,
      packId,
      name: 'S',
      fileKey: 'k.webp',
      fileUrl: 'https://cdn/x.webp',
      tags: [],
      sortOrder: 0,
      createdAt: new Date(),
      pack: mockPack(),
      ...overrides,
    } as UserSticker;
  }

  beforeEach(async () => {
    const mockPacks = {
      create: jest.fn((x: Partial<UserStickerPack>) => ({ ...x })),
      save: jest.fn(async (x: UserStickerPack) => x),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      findAndCount: jest.fn(),
    };
    const mockStickers = {
      create: jest.fn((x: Partial<UserSticker>) => ({ ...x })),
      save: jest.fn(async (x: UserSticker) => x),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const mockDownloads = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      findOne: jest.fn(),
    };
    usersRepository = { findOne: jest.fn() };
    s3 = {
      getObjectBuffer: jest.fn(),
      putObjectBuffer: jest.fn(),
      resolveFileUrl: jest.fn((k) => `https://cdn/${k}`),
      deleteFile: jest.fn(),
    };
    webp = { toWebp: jest.fn(async (b: Buffer) => b) };
    moderation = { enqueueImageModeration: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserStickerPackService,
        { provide: getRepositoryToken(UserStickerPack), useValue: mockPacks },
        { provide: getRepositoryToken(UserSticker), useValue: mockStickers },
        { provide: getRepositoryToken(UserStickerPackDownload), useValue: mockDownloads },
        { provide: UsersRepository, useValue: usersRepository },
        { provide: S3StorageService, useValue: s3 },
        { provide: StickerWebpService, useValue: webp },
        { provide: ModerationQueueService, useValue: moderation },
      ],
    }).compile();

    service = module.get(UserStickerPackService);
    packs = module.get(getRepositoryToken(UserStickerPack));
    stickers = module.get(getRepositoryToken(UserSticker));
    downloads = module.get(getRepositoryToken(UserStickerPackDownload));
  });

  it('createPack respects silver cap', async () => {
    usersRepository.findOne.mockResolvedValue({ tier: UserTier.SILVER } as any);
    packs.count.mockResolvedValue(MAX_UGC_PACKS_SILVER);
    await expect(service.createPack(creatorId, { name: 'P' })).rejects.toThrow(BadRequestException);
  });

  it('createPack allows gold tier up to gold cap', async () => {
    usersRepository.findOne.mockResolvedValue({ tier: UserTier.GOLD } as any);
    packs.count.mockResolvedValue(MAX_UGC_PACKS_GOLD_BLACK - 1);
    packs.save.mockImplementation(async (p: any) =>
      Object.assign(p, { id: packId, createdAt: new Date() }),
    );
    const dto = await service.createPack(creatorId, { name: 'P', price: 0 });
    expect(dto.id).toBe(packId);
    expect(dto.price).toBe('0.00');
  });

  it('getPack returns full pack for creator when unpublished', async () => {
    const st = mockSticker();
    packs.findOne.mockResolvedValue(mockPack({ isPublished: false, stickers: [st] }));
    const res = await service.getPack(packId, creatorId);
    expect(res.stickers).toHaveLength(1);
  });

  it('getPack hides draft from non-creator', async () => {
    packs.findOne.mockResolvedValue(mockPack({ isPublished: false, stickers: [] }));
    downloads.findOne.mockResolvedValue(null);
    await expect(service.getPack(packId, otherId)).rejects.toThrow(NotFoundException);
  });

  it('getPack throws when pack id unknown', async () => {
    packs.findOne.mockResolvedValue(null);
    await expect(service.getPack(packId, creatorId)).rejects.toThrow(NotFoundException);
  });

  it('getPack allows public approved pack for anyone', async () => {
    const st = mockSticker();
    packs.findOne.mockResolvedValue(
      mockPack({ isPublished: true, isApproved: true, stickers: [st] }),
    );
    const res = await service.getPack(packId, otherId);
    expect(res.stickers).toHaveLength(1);
  });

  it('addSticker uploads webp and sets cover', async () => {
    usersRepository.findOne.mockResolvedValue({ tier: UserTier.SILVER } as any);
    const pack = mockPack({ stickers: [] });
    packs.findOne.mockResolvedValue(pack);
    stickers.save.mockImplementation(async (s: any) =>
      Object.assign(s, { id: stickerId, createdAt: new Date() }),
    );
    const file = { buffer: Buffer.from('x'), size: 3 } as Express.Multer.File;
    const res = await service.addSticker(packId, creatorId, { name: 'n' }, file);
    expect(webp.toWebp).toHaveBeenCalled();
    expect(s3.putObjectBuffer).toHaveBeenCalled();
    expect(res.fileUrl).toContain('https://cdn/');
    expect(packs.save).toHaveBeenCalled();
  });

  it('addSticker rejects when at sticker limit', async () => {
    const many = Array.from({ length: MAX_STICKERS_PER_UGC_PACK }, (_, i) =>
      mockSticker({ id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}` }),
    );
    packs.findOne.mockResolvedValue(mockPack({ stickers: many }));
    await expect(
      service.addSticker(packId, creatorId, { name: 'x' }, {
        buffer: Buffer.from('x'),
        size: 2,
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
  });

  it('removeSticker deletes s3 and reassigns cover', async () => {
    const s1 = mockSticker({ id: '01', fileUrl: 'https://a/1.webp', sortOrder: 0 });
    const s2 = mockSticker({
      id: '02',
      fileUrl: 'https://a/2.webp',
      sortOrder: 1,
      fileKey: 'k2',
    });
    packs.findOne.mockResolvedValue(mockPack({ coverUrl: s1.fileUrl, stickers: [s1, s2] }));
    stickers.findOne.mockResolvedValue(s1);
    stickers.find.mockResolvedValue([s2]);
    await service.removeSticker(packId, s1.id, creatorId);
    expect(s3.deleteFile).toHaveBeenCalledWith(s1.fileKey);
    expect(packs.save).toHaveBeenCalledWith(expect.objectContaining({ coverUrl: s2.fileUrl }));
  });

  it('publishPack throws when pack missing', async () => {
    packs.findOne.mockResolvedValue(null);
    await expect(service.publishPack(packId, creatorId)).rejects.toThrow(NotFoundException);
  });

  it('publishPack enqueues moderation', async () => {
    const st = mockSticker();
    const entity = mockPack({ stickers: [st] });
    packs.findOne.mockResolvedValue(entity);
    packs.save.mockImplementation(async (p: any) => p);
    const res = await service.publishPack(packId, creatorId);
    expect(res.isPublished).toBe(true);
    expect(moderation.enqueueImageModeration).toHaveBeenCalled();
  });

  it('downloadPack throws when pack missing', async () => {
    packs.findOne.mockResolvedValue(null);
    await expect(service.downloadPack(packId, otherId)).rejects.toThrow(NotFoundException);
  });

  it('downloadPack rejects when not approved', async () => {
    packs.findOne.mockResolvedValue(mockPack({ isPublished: true, isApproved: false, stickers: [] }));
    await expect(service.downloadPack(packId, otherId)).rejects.toThrow(ForbiddenException);
  });

  it('downloadPack rejects paid packs', async () => {
    packs.findOne.mockResolvedValue(
      mockPack({ isPublished: true, isApproved: true, price: '9.99', stickers: [] }),
    );
    await expect(service.downloadPack(packId, otherId)).rejects.toThrow(BadRequestException);
  });

  it('downloadPack records download and bumps count', async () => {
    const st = mockSticker();
    packs.findOne.mockResolvedValue(
      mockPack({ isPublished: true, isApproved: true, stickers: [st], downloadCount: 0 }),
    );
    downloads.findOne.mockResolvedValue(null);
    const res = await service.downloadPack(packId, otherId);
    expect(res.success).toBe(true);
    expect(downloads.save).toHaveBeenCalled();
    expect(packs.save).toHaveBeenCalledWith(expect.objectContaining({ downloadCount: 1 }));
  });

  it('non-owner cannot add sticker', async () => {
    packs.findOne.mockResolvedValue(mockPack());
    await expect(
      service.addSticker(packId, otherId, { name: 'x', fileKey: 'k' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('adminRejectPack unpublishes', async () => {
    packs.findOne.mockResolvedValue(mockPack({ isPublished: true, isApproved: true, stickers: [] }));
    const res = await service.adminRejectPack(packId);
    expect(res.isApproved).toBe(false);
    expect(res.isPublished).toBe(false);
  });

  it('createPack throws when user missing', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    await expect(service.createPack(creatorId, { name: 'P' })).rejects.toThrow(NotFoundException);
  });

  it('browsePublicPacks clamps limit to 50', async () => {
    packs.findAndCount.mockResolvedValue([[], 0]);
    const r = await service.browsePublicPacks(1, 999);
    expect(r.limit).toBe(50);
  });

  it('listMyPacks returns summary rows', async () => {
    packs.find.mockResolvedValue([mockPack({ stickers: [] })]);
    const rows = await service.listMyPacks(creatorId);
    expect(rows).toHaveLength(1);
    expect(rows[0].stickerCount).toBe(0);
  });

  it('addSticker rejects oversized file', async () => {
    packs.findOne.mockResolvedValue(mockPack({ stickers: [] }));
    const huge = {
      buffer: Buffer.alloc(1),
      size: MAX_STICKER_UPLOAD_BYTES + 1,
    } as Express.Multer.File;
    await expect(service.addSticker(packId, creatorId, { name: 'n' }, huge)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('addSticker uses fileKey and skips cover update when set', async () => {
    packs.findOne.mockResolvedValue(mockPack({ stickers: [], coverUrl: 'https://old/cover.webp' }));
    s3.getObjectBuffer.mockResolvedValue(Buffer.from('x'));
    stickers.save.mockImplementation(async (s: any) =>
      Object.assign(s, { id: stickerId, createdAt: new Date() }),
    );
    await service.addSticker(packId, creatorId, { name: 'n', fileKey: 'raw/key' });
    expect(s3.getObjectBuffer).toHaveBeenCalledWith('raw/key');
    expect(packs.save).not.toHaveBeenCalled();
  });

  it('addSticker rejects without file or key', async () => {
    packs.findOne.mockResolvedValue(mockPack({ stickers: [] }));
    await expect(service.addSticker(packId, creatorId, { name: 'n' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('publishPack requires at least one sticker', async () => {
    packs.findOne.mockResolvedValue(mockPack({ stickers: [] }));
    await expect(service.publishPack(packId, creatorId)).rejects.toThrow(BadRequestException);
  });

  it('unpublishPack throws when pack missing', async () => {
    packs.findOne.mockResolvedValue(null);
    await expect(service.unpublishPack(packId, creatorId)).rejects.toThrow(NotFoundException);
  });

  it('unpublishPack', async () => {
    const st = mockSticker();
    const p = mockPack({ stickers: [st], isPublished: true });
    packs.findOne.mockResolvedValue(p);
    packs.save.mockImplementation(async (x: any) => x);
    const r = await service.unpublishPack(packId, creatorId);
    expect(r.isPublished).toBe(false);
  });

  it('downloadPack short-circuits for creator', async () => {
    const st = mockSticker();
    packs.findOne.mockResolvedValue(
      mockPack({ stickers: [st], isPublished: true, isApproved: true, creatorId }),
    );
    const r = await service.downloadPack(packId, creatorId);
    expect(r.message).toContain('creator');
    expect(downloads.save).not.toHaveBeenCalled();
  });

  it('downloadPack does not double-count downloads', async () => {
    const st = mockSticker();
    packs.findOne.mockResolvedValue(
      mockPack({
        stickers: [st],
        isPublished: true,
        isApproved: true,
        creatorId: otherId,
        downloadCount: 2,
      }),
    );
    downloads.findOne.mockResolvedValue({ id: 'dl' } as any);
    await service.downloadPack(packId, creatorId);
    expect(downloads.save).not.toHaveBeenCalled();
    expect(packs.save).not.toHaveBeenCalled();
  });

  it('moderatePack no-ops when pack missing', async () => {
    packs.findOne.mockResolvedValue(null);
    await service.moderatePack('missing-pack');
    expect(moderation.enqueueImageModeration).not.toHaveBeenCalled();
  });

  it('moderatePack no-ops without image URL', async () => {
    packs.findOne.mockResolvedValue(mockPack({ coverUrl: null, stickers: [] }));
    await service.moderatePack(packId);
    expect(moderation.enqueueImageModeration).not.toHaveBeenCalled();
  });

  it('moderatePack swallows enqueue errors', async () => {
    const st = mockSticker({ fileUrl: 'https://x' });
    packs.findOne.mockResolvedValue(mockPack({ coverUrl: null, stickers: [st] }));
    moderation.enqueueImageModeration.mockRejectedValue(new Error('queue down'));
    await expect(service.moderatePack(packId)).resolves.toBeUndefined();
  });

  it('adminApprovePack throws when missing', async () => {
    packs.findOne.mockResolvedValue(null);
    await expect(service.adminApprovePack(packId)).rejects.toThrow(NotFoundException);
  });

  it('adminRejectPack throws when missing', async () => {
    packs.findOne.mockResolvedValue(null);
    await expect(service.adminRejectPack(packId)).rejects.toThrow(NotFoundException);
  });

  it('adminApprovePack sets approved', async () => {
    packs.findOne.mockResolvedValue(mockPack({ stickers: [] }));
    packs.save.mockImplementation(async (p: any) => p);
    const r = await service.adminApprovePack(packId);
    expect(r.isApproved).toBe(true);
  });

  it('removeSticker throws when pack missing', async () => {
    packs.findOne.mockResolvedValue(null);
    await expect(service.removeSticker(packId, stickerId, creatorId)).rejects.toThrow(NotFoundException);
  });

  it('removeSticker throws when sticker missing', async () => {
    packs.findOne.mockResolvedValue(mockPack());
    stickers.findOne.mockResolvedValue(null);
    await expect(service.removeSticker(packId, stickerId, creatorId)).rejects.toThrow(NotFoundException);
  });

  it('removeSticker continues when S3 delete fails', async () => {
    const st = mockSticker();
    packs.findOne.mockResolvedValue(mockPack({ stickers: [st] }));
    stickers.findOne.mockResolvedValue(st);
    stickers.find.mockResolvedValue([]);
    s3.deleteFile.mockRejectedValue(new Error('s3'));
    await service.removeSticker(packId, st.id, creatorId);
    expect(stickers.remove).toHaveBeenCalled();
  });

  it('removeSticker clears cover when last sticker removed', async () => {
    const st = mockSticker();
    packs.findOne.mockResolvedValue(mockPack({ coverUrl: st.fileUrl, stickers: [st] }));
    stickers.findOne.mockResolvedValue(st);
    stickers.find.mockResolvedValue([]);
    await service.removeSticker(packId, st.id, creatorId);
    expect(packs.save).toHaveBeenCalledWith(expect.objectContaining({ coverUrl: null }));
  });

  it('getUserLibraryStickers returns empty when no packs', async () => {
    stickers.createQueryBuilder.mockImplementation(() => {
      const chain: any = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      return chain;
    });
    const list = await service.getUserLibraryStickers(creatorId);
    expect(list).toEqual([]);
  });

  it('getUserLibraryStickers merges owned and downloaded', async () => {
    const owned = mockSticker({ id: 'o1', packId: 'p1' });
    const dl = mockSticker({ id: 'd1', packId: 'p2' });
    let qbCall = 0;
    stickers.createQueryBuilder.mockImplementation(() => {
      const chain: any = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockImplementation(async () => {
          qbCall++;
          return qbCall === 1 ? [owned] : [dl];
        }),
      };
      return chain;
    });
    const list = await service.getUserLibraryStickers(creatorId);
    expect(list.map((x) => x.id).sort()).toEqual(['d1', 'o1']);
  });
});
