import { Test, TestingModule } from '@nestjs/testing';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminPlatformInvitesController } from './admin-platform-invites.controller';
import {
  BulkGenerateInvitesDto,
  GeneratePlatformInviteDto,
  ListInvitesQueryDto,
  ToggleInviteModeDto,
} from './dto/platform-invite.dto';
import { PlatformInviteService } from './platform-invite.service';

describe('AdminPlatformInvitesController', () => {
  let controller: AdminPlatformInvitesController;
  let service: jest.Mocked<Pick<PlatformInviteService, keyof PlatformInviteService>>;

  const adminId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(async () => {
    service = {
      generateInvite: jest.fn(),
      generateBulk: jest.fn(),
      getInviteStats: jest.fn(),
      getInvites: jest.fn(),
      setInviteMode: jest.fn(),
      revokeInvite: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPlatformInvitesController],
      providers: [{ provide: PlatformInviteService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminPlatformInvitesController);
  });

  it('generate delegates to service', async () => {
    const dto: GeneratePlatformInviteDto = { maxUses: 1 };
    service.generateInvite.mockResolvedValue({ id: '1' } as any);
    await expect(controller.generate(adminId, dto)).resolves.toEqual({ id: '1' });
    expect(service.generateInvite).toHaveBeenCalledWith(adminId, dto);
  });

  it('generateBulk delegates', async () => {
    const dto: BulkGenerateInvitesDto = { count: 2, maxUses: 1 };
    service.generateBulk.mockResolvedValue([]);
    await controller.generateBulk(adminId, dto);
    expect(service.generateBulk).toHaveBeenCalledWith(adminId, dto);
  });

  it('stats delegates', async () => {
    service.getInviteStats.mockResolvedValue({} as any);
    await controller.stats();
    expect(service.getInviteStats).toHaveBeenCalled();
  });

  it('list delegates', async () => {
    const q: ListInvitesQueryDto = { page: 1, limit: 10 };
    service.getInvites.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
    await controller.list(q);
    expect(service.getInvites).toHaveBeenCalledWith(q);
  });

  it('toggleMode delegates', async () => {
    const dto: ToggleInviteModeDto = { enabled: true };
    service.setInviteMode.mockResolvedValue({ inviteModeEnabled: true });
    await expect(controller.toggleMode(dto)).resolves.toEqual({ inviteModeEnabled: true });
    expect(service.setInviteMode).toHaveBeenCalledWith(true);
  });

  it('revoke delegates', async () => {
    service.revokeInvite.mockResolvedValue(undefined);
    await controller.revoke('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
    expect(service.revokeInvite).toHaveBeenCalledWith('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
  });
});
