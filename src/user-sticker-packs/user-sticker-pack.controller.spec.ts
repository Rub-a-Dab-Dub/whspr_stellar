import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserStickerPackController } from './user-sticker-pack.controller';
import { UserStickerPackService } from './user-sticker-pack.service';

describe('UserStickerPackController', () => {
  let controller: UserStickerPackController;
  const packs = {
    browsePublicPacks: jest.fn(),
    getUserLibraryStickers: jest.fn(),
    listMyPacks: jest.fn(),
    getPack: jest.fn(),
    createPack: jest.fn(),
    addSticker: jest.fn(),
    removeSticker: jest.fn(),
    publishPack: jest.fn(),
    unpublishPack: jest.fn(),
    downloadPack: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserStickerPackController],
      providers: [{ provide: UserStickerPackService, useValue: packs }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(UserStickerPackController);
    jest.clearAllMocks();
  });

  it('browsePublicPacks delegates', async () => {
    packs.browsePublicPacks.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    await controller.browsePublicPacks({ page: 1, limit: 20 });
    expect(packs.browsePublicPacks).toHaveBeenCalledWith(1, 20);
  });

  it('createPack delegates', async () => {
    packs.createPack.mockResolvedValue({ id: 'x' });
    await controller.createPack('u1', { name: 'P' });
    expect(packs.createPack).toHaveBeenCalledWith('u1', { name: 'P' });
  });

  it('delegates authenticated routes', async () => {
    packs.getUserLibraryStickers.mockResolvedValue([]);
    packs.listMyPacks.mockResolvedValue([]);
    packs.getPack.mockResolvedValue({ id: 'p' } as any);
    packs.addSticker.mockResolvedValue({ id: 's' } as any);
    packs.removeSticker.mockResolvedValue(undefined);
    packs.publishPack.mockResolvedValue({ id: 'p' } as any);
    packs.unpublishPack.mockResolvedValue({ id: 'p' } as any);
    packs.downloadPack.mockResolvedValue({ success: true, stickersUnlocked: 1, message: 'ok' });

    await controller.getLibrary('u1');
    await controller.listMine('u1');
    await controller.getPack('pid', 'u1');
    await controller.addSticker('pid', 'u1', { name: 'n' }, undefined);
    await controller.removeSticker('pid', 'sid', 'u1');
    await controller.publishPack('pid', 'u1');
    await controller.unpublishPack('pid', 'u1');
    await controller.downloadPack('pid', 'u1');

    expect(packs.getUserLibraryStickers).toHaveBeenCalledWith('u1');
    expect(packs.listMyPacks).toHaveBeenCalledWith('u1');
    expect(packs.getPack).toHaveBeenCalledWith('pid', 'u1');
    expect(packs.addSticker).toHaveBeenCalledWith('pid', 'u1', { name: 'n' }, undefined);
    expect(packs.removeSticker).toHaveBeenCalledWith('pid', 'sid', 'u1');
    expect(packs.publishPack).toHaveBeenCalledWith('pid', 'u1');
    expect(packs.unpublishPack).toHaveBeenCalledWith('pid', 'u1');
    expect(packs.downloadPack).toHaveBeenCalledWith('pid', 'u1');
  });
});
