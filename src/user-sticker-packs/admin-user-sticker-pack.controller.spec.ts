import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminUserStickerPackController } from './admin-user-sticker-pack.controller';
import { UserStickerPackService } from './user-sticker-pack.service';

describe('AdminUserStickerPackController', () => {
  let controller: AdminUserStickerPackController;
  const packs = {
    adminApprovePack: jest.fn(),
    adminRejectPack: jest.fn(),
    moderatePack: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUserStickerPackController],
      providers: [{ provide: UserStickerPackService, useValue: packs }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AdminUserStickerPackController);
    jest.clearAllMocks();
  });

  it('approve delegates', async () => {
    packs.adminApprovePack.mockResolvedValue({ id: 'p' });
    await controller.approve('pack-id');
    expect(packs.adminApprovePack).toHaveBeenCalledWith('pack-id');
  });

  it('reject and moderate delegate', async () => {
    packs.adminRejectPack.mockResolvedValue({ id: 'p' });
    packs.moderatePack.mockResolvedValue(undefined);
    await controller.reject('p2');
    await controller.moderate('p3');
    expect(packs.adminRejectPack).toHaveBeenCalledWith('p2');
    expect(packs.moderatePack).toHaveBeenCalledWith('p3');
  });
});
