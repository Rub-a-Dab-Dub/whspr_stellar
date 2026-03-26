import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { StickersService } from './stickers.service';
import { StickersRepository } from './stickers.repository';
import { StickerPacksRepository } from './sticker-packs.repository';
import { CacheService } from '../services/cache.service';
import { Sticker } from './entities/sticker.entity';
import { StickerPack } from './entities/sticker-pack.entity';

jest.mock('axios');

describe('StickersService', () => {
  let service: StickersService;
  let stickersRepository: StickersRepository;
  let stickerPacksRepository: StickerPacksRepository;
  let cacheService: CacheService;
  let configService: ConfigService;

  const mockSticker: Sticker = {
    id: 'sticker-1',
    packId: 'pack-1',
    name: 'Happy Face',
    fileUrl: 'https://cdn.example.com/sticker-1.webp',
    thumbnailUrl: 'https://cdn.example.com/sticker-1-thumb.png',
    tags: ['happy', 'face', 'emotion'],
    pack: null as any,
    createdAt: new Date(),
  };

  const mockStickerPack: StickerPack = {
    id: 'pack-1',
    name: 'Emotions',
    author: 'Official',
    isOfficial: true,
    coverUrl: 'https://cdn.example.com/pack-1-cover.png',
    stickerCount: 10,
    stickers: [mockSticker],
    createdAt: new Date(),
  };

  const mockCacheServiceMethods = {
    wrap: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockStickersRepositoryMethods = {
    findStickerById: jest.fn(),
    searchStickersByNameOrTag: jest.fn(),
    findStickersByPackId: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockStickerPacksRepositoryMethods = {
    findAllPacks: jest.fn(),
    findOfficialPacks: jest.fn(),
    findPackByIdWithStickers: jest.fn(),
    findPackByName: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StickersService,
        {
          provide: StickersRepository,
          useValue: mockStickersRepositoryMethods,
        },
        {
          provide: StickerPacksRepository,
          useValue: mockStickerPacksRepositoryMethods,
        },
        {
          provide: CacheService,
          useValue: mockCacheServiceMethods,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'TENOR_API_KEY') return 'test-tenor-key';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StickersService>(StickersService);
    stickersRepository = module.get<StickersRepository>(StickersRepository);
    stickerPacksRepository = module.get<StickerPacksRepository>(StickerPacksRepository);
    cacheService = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStickerPacks', () => {
    it('should return paginated sticker packs with cache', async () => {
      const pagination = { page: 1, limit: 10 };
      const mockResponse = {
        data: [mockStickerPack],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockCacheServiceMethods.wrap.mockResolvedValue(mockResponse);

      const result = await service.getStickerPacks(pagination);

      expect(result).toEqual(mockResponse);
      expect(mockCacheServiceMethods.wrap).toHaveBeenCalled();
    });
  });

  describe('getOfficialStickerPacks', () => {
    it('should return only official sticker packs', async () => {
      const pagination = { page: 1, limit: 10 };
      const mockResponse = {
        data: [mockStickerPack],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockCacheServiceMethods.wrap.mockResolvedValue(mockResponse);

      const result = await service.getOfficialStickerPacks(pagination);

      expect(result).toEqual(mockResponse);
      expect(mockCacheServiceMethods.wrap).toHaveBeenCalled();
    });
  });

  describe('getPackStickers', () => {
    it('should return sticker pack with all stickers', async () => {
      mockCacheServiceMethods.wrap.mockResolvedValue(mockStickerPack);

      const result = await service.getPackStickers('pack-1');

      expect(result.id).toBe('pack-1');
      expect(result.name).toBe('Emotions');
      expect(mockCacheServiceMethods.wrap).toHaveBeenCalled();
    });

    it('should throw NotFoundException when pack does not exist', async () => {
      mockCacheServiceMethods.wrap.mockRejectedValue(
        new NotFoundException('Sticker pack with ID unknown not found'),
      );

      await expect(service.getPackStickers('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSticker', () => {
    it('should return sticker by ID', async () => {
      mockStickersRepositoryMethods.findStickerById.mockResolvedValue(mockSticker);

      const result = await service.getSticker('sticker-1');

      expect(result.id).toBe('sticker-1');
      expect(result.name).toBe('Happy Face');
      expect(mockStickersRepositoryMethods.findStickerById).toHaveBeenCalledWith('sticker-1');
    });

    it('should throw NotFoundException when sticker does not exist', async () => {
      mockStickersRepositoryMethods.findStickerById.mockResolvedValue(null);

      await expect(service.getSticker('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchStickers', () => {
    it('should search stickers by name and tags', async () => {
      mockStickersRepositoryMethods.searchStickersByNameOrTag.mockResolvedValue([mockSticker]);

      const result = await service.searchStickers('happy');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Happy Face');
      expect(mockStickersRepositoryMethods.searchStickersByNameOrTag).toHaveBeenCalledWith('happy');
    });

    it('should throw BadRequestException for empty query', async () => {
      await expect(service.searchStickers('')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for whitespace query', async () => {
      await expect(service.searchStickers('   ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('searchGIFs', () => {
    it('should search GIFs from Tenor API with caching', async () => {
      const mockGifResponse = {
        results: [
          {
            id: 'gif-1',
            title: 'Happy Dance',
            media: [
              {
                webm: { url: 'https://media.tenor.com/happy.webm' },
                mp4: { url: 'https://media.tenor.com/happy.mp4' },
                gif: { url: 'https://media.tenor.com/happy.gif' },
              },
            ],
            media_formats: {
              tinygif: { url: 'https://media.tenor.com/happy-tiny.gif' },
            },
          },
        ],
      };

      mockCacheServiceMethods.wrap.mockResolvedValue([
        {
          id: 'gif-1',
          title: 'Happy Dance',
          webmUrl: 'https://media.tenor.com/happy.webm',
          mp4Url: 'https://media.tenor.com/happy.mp4',
          gifUrl: 'https://media.tenor.com/happy.gif',
          mediaUrl: 'https://media.tenor.com/happy.webm',
          thumbnailUrl: 'https://media.tenor.com/happy-tiny.gif',
        },
      ]);

      const result = await service.searchGIFs('happy', 10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gif-1');
      expect(mockCacheServiceMethods.wrap).toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty GIF query', async () => {
      await expect(service.searchGIFs('')).rejects.toThrow(BadRequestException);
    });

    it('should limit GIF results between 1 and 50', async () => {
      mockCacheServiceMethods.wrap.mockResolvedValue([]);

      await service.searchGIFs('happy', 100);
      await service.searchGIFs('happy', 0);
      await service.searchGIFs('happy', -5);

      expect(mockCacheServiceMethods.wrap).toHaveBeenCalled();
    });

    it('should return empty array when Tenor API key is not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('');

      const newService = new StickersService(
        stickersRepository,
        stickerPacksRepository,
        cacheService,
        configService,
      );

      const result = await newService.searchGIFs('happy', 10);

      expect(result).toEqual([]);
    });

    it('should handle Tenor API errors gracefully', async () => {
      mockCacheServiceMethods.wrap.mockImplementation(async (_key, loader) => {
        throw new Error('API Error');
      });

      const result = await service.searchGIFs('happy', 10);

      expect(result).toEqual([]);
    });
  });

  describe('addOfficialPack', () => {
    it('should create official sticker pack', async () => {
      const createDto = {
        name: 'New Pack',
        author: 'Test Author',
        isOfficial: true,
        coverUrl: 'https://cdn.example.com/cover.png',
      };

      mockStickerPacksRepositoryMethods.create.mockReturnValue(createDto);
      mockStickerPacksRepositoryMethods.save.mockResolvedValue({
        ...createDto,
        id: 'pack-new',
        stickerCount: 0,
        stickers: [],
        createdAt: new Date(),
      });
      mockCacheServiceMethods.del.mockResolvedValue(undefined);

      const result = await service.addOfficialPack(createDto);

      expect(result.isOfficial).toBe(true);
      expect(mockStickerPacksRepositoryMethods.create).toHaveBeenCalled();
      expect(mockStickerPacksRepositoryMethods.save).toHaveBeenCalled();
      expect(mockCacheServiceMethods.del).toHaveBeenCalled();
    });
  });

  describe('addStickerToPack', () => {
    it('should add sticker to pack', async () => {
      const createDto = {
        packId: 'pack-1',
        name: 'New Sticker',
        fileUrl: 'https://cdn.example.com/sticker.webp',
        thumbnailUrl: 'https://cdn.example.com/sticker-thumb.png',
        tags: ['new'],
      };

      mockStickerPacksRepositoryMethods.findOne.mockResolvedValue(mockStickerPack);
      mockStickersRepositoryMethods.create.mockReturnValue(createDto);
      mockStickersRepositoryMethods.save.mockResolvedValue({
        ...createDto,
        id: 'sticker-new',
        pack: mockStickerPack,
        createdAt: new Date(),
      });
      mockStickerPacksRepositoryMethods.save.mockResolvedValue(mockStickerPack);
      mockCacheServiceMethods.del.mockResolvedValue(undefined);

      const result = await service.addStickerToPack(createDto);

      expect(result.name).toBe('New Sticker');
      expect(mockStickersRepositoryMethods.create).toHaveBeenCalled();
      expect(mockCacheServiceMethods.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException when pack does not exist', async () => {
      const createDto = {
        packId: 'unknown',
        name: 'New Sticker',
        fileUrl: 'https://cdn.example.com/sticker.webp',
        thumbnailUrl: 'https://cdn.example.com/sticker-thumb.png',
        tags: ['new'],
      };

      mockStickerPacksRepositoryMethods.findOne.mockResolvedValue(null);

      await expect(service.addStickerToPack(createDto)).rejects.toThrow(NotFoundException);
    });
  });
});
