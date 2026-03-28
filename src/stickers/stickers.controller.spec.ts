import { Test, TestingModule } from '@nestjs/testing';
import { StickersController, GifsController } from './stickers.controller';
import { StickersService } from './stickers.service';
import { StickerResponseDto } from './dto/sticker-response.dto';
import { StickerPackResponseDto } from './dto/sticker-pack-response.dto';
import { GifResultDto } from './dto/gif-result.dto';

describe('StickersController', () => {
  let controller: StickersController;
  let service: StickersService;

  const mockStickerResponseDto: StickerResponseDto = {
    id: 'sticker-1',
    packId: 'pack-1',
    name: 'Happy Face',
    fileUrl: 'https://cdn.example.com/sticker-1.webp',
    thumbnailUrl: 'https://cdn.example.com/sticker-1-thumb.png',
    tags: ['happy', 'face'],
    createdAt: new Date(),
  };

  const mockStickerPackResponseDto: StickerPackResponseDto = {
    id: 'pack-1',
    name: 'Emotions',
    author: 'Official',
    isOfficial: true,
    coverUrl: 'https://cdn.example.com/pack-1-cover.png',
    stickerCount: 10,
    createdAt: new Date(),
    stickers: [mockStickerResponseDto],
  };

  const mockServiceMethods = {
    getStickerPacks: jest.fn(),
    getOfficialStickerPacks: jest.fn(),
    getPackStickers: jest.fn(),
    getSticker: jest.fn(),
    searchStickers: jest.fn(),
    searchGIFs: jest.fn(),
    addOfficialPack: jest.fn(),
    addStickerToPack: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StickersController],
      providers: [
        {
          provide: StickersService,
          useValue: mockServiceMethods,
        },
      ],
    }).compile();

    controller = module.get<StickersController>(StickersController);
    service = module.get<StickersService>(StickersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStickerPacks', () => {
    it('should get all sticker packs', async () => {
      const mockResponse = {
        data: [mockStickerPackResponseDto],
        total: 1,
        page: 1,
        limit: 10,
      };
      mockServiceMethods.getStickerPacks.mockResolvedValue(mockResponse);

      const result = await controller.getStickerPacks({ page: 1, limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(mockServiceMethods.getStickerPacks).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });
  });

  describe('getOfficialStickerPacks', () => {
    it('should get official sticker packs', async () => {
      const mockResponse = {
        data: [mockStickerPackResponseDto],
        total: 1,
        page: 1,
        limit: 10,
      };
      mockServiceMethods.getOfficialStickerPacks.mockResolvedValue(mockResponse);

      const result = await controller.getOfficialStickerPacks({ page: 1, limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(mockServiceMethods.getOfficialStickerPacks).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });
  });

  describe('getPackStickers', () => {
    it('should get stickers for a pack', async () => {
      mockServiceMethods.getPackStickers.mockResolvedValue(mockStickerPackResponseDto);

      const result = await controller.getPackStickers('pack-1');

      expect(result).toEqual(mockStickerPackResponseDto);
      expect(mockServiceMethods.getPackStickers).toHaveBeenCalledWith('pack-1');
    });
  });

  describe('searchStickers', () => {
    it('should search stickers', async () => {
      const mockResults = [mockStickerResponseDto];
      mockServiceMethods.searchStickers.mockResolvedValue(mockResults);

      const result = await controller.searchStickers('happy');

      expect(result).toEqual(mockResults);
      expect(mockServiceMethods.searchStickers).toHaveBeenCalledWith('happy');
    });
  });

  describe('getSticker', () => {
    it('should get single sticker by ID', async () => {
      mockServiceMethods.getSticker.mockResolvedValue(mockStickerResponseDto);

      const result = await controller.getSticker('sticker-1');

      expect(result).toEqual(mockStickerResponseDto);
      expect(mockServiceMethods.getSticker).toHaveBeenCalledWith('sticker-1');
    });
  });

  describe('createStickerPack', () => {
    it('should create official sticker pack', async () => {
      const createDto = {
        name: 'New Pack',
        author: 'Test Author',
        isOfficial: true,
        coverUrl: 'https://cdn.example.com/cover.png',
      };
      mockServiceMethods.addOfficialPack.mockResolvedValue({
        ...mockStickerPackResponseDto,
        ...createDto,
      });

      const result = await controller.createStickerPack(createDto);

      expect(result.name).toBe('New Pack');
      expect(mockServiceMethods.addOfficialPack).toHaveBeenCalledWith(createDto);
    });
  });

  describe('createSticker', () => {
    it('should create sticker', async () => {
      const createDto = {
        packId: 'pack-1',
        name: 'New Sticker',
        fileUrl: 'https://cdn.example.com/sticker.webp',
        thumbnailUrl: 'https://cdn.example.com/sticker-thumb.png',
        tags: ['new'],
      };
      mockServiceMethods.addStickerToPack.mockResolvedValue({
        ...mockStickerResponseDto,
        ...createDto,
      });

      const result = await controller.createSticker(createDto);

      expect(result.name).toBe('New Sticker');
      expect(mockServiceMethods.addStickerToPack).toHaveBeenCalledWith(createDto);
    });
  });
});

describe('GifsController', () => {
  let controller: GifsController;
  let service: StickersService;

  const mockGifResultDto: GifResultDto = {
    id: 'gif-1',
    title: 'Happy Dance',
    webmUrl: 'https://media.tenor.com/happy.webm',
    mp4Url: 'https://media.tenor.com/happy.mp4',
    gifUrl: 'https://media.tenor.com/happy.gif',
    mediaUrl: 'https://media.tenor.com/happy.webm',
    thumbnailUrl: 'https://media.tenor.com/happy-tiny.gif',
  };

  const mockServiceMethods = {
    searchGIFs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GifsController],
      providers: [
        {
          provide: StickersService,
          useValue: mockServiceMethods,
        },
      ],
    }).compile();

    controller = module.get<GifsController>(GifsController);
    service = module.get<StickersService>(StickersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchGifs', () => {
    it('should search GIFs with default limit', async () => {
      const mockResults = [mockGifResultDto];
      mockServiceMethods.searchGIFs.mockResolvedValue(mockResults);

      const result = await controller.searchGifs('happy');

      expect(result).toEqual(mockResults);
      expect(mockServiceMethods.searchGIFs).toHaveBeenCalledWith('happy', 10);
    });

    it('should search GIFs with custom limit', async () => {
      const mockResults = [mockGifResultDto];
      mockServiceMethods.searchGIFs.mockResolvedValue(mockResults);

      const result = await controller.searchGifs('happy', 20);

      expect(result).toEqual(mockResults);
      expect(mockServiceMethods.searchGIFs).toHaveBeenCalledWith('happy', 20);
    });
  });
});
