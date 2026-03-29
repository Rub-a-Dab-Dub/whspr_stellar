import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SystemSetting } from '../admin/entities/system-setting.entity';
import { INVITE_MODE_CACHE_TTL_MS, INVITE_MODE_SETTING_KEY, InviteModeService } from './invite-mode.service';

describe('InviteModeService', () => {
  let service: InviteModeService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x as SystemSetting),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteModeService,
        { provide: getRepositoryToken(SystemSetting), useValue: repo },
      ],
    }).compile();

    service = module.get(InviteModeService);
  });

  it('loads invite mode from DB when cache cold', async () => {
    repo.findOne.mockResolvedValue({ key: INVITE_MODE_SETTING_KEY, value: 'true' } as SystemSetting);
    await expect(service.isInviteModeEnabled()).resolves.toBe(true);
    expect(repo.findOne).toHaveBeenCalled();
  });

  it('uses cache within TTL', async () => {
    repo.findOne.mockResolvedValue({ key: INVITE_MODE_SETTING_KEY, value: 'false' } as SystemSetting);
    await service.isInviteModeEnabled();
    await service.isInviteModeEnabled();
    expect(repo.findOne).toHaveBeenCalledTimes(1);
  });

  it('setInviteModeEnabled persists and busts cache', async () => {
    repo.findOne
      .mockResolvedValueOnce({ key: INVITE_MODE_SETTING_KEY, value: 'false' } as SystemSetting)
      .mockResolvedValueOnce({ key: INVITE_MODE_SETTING_KEY, value: 'false' } as SystemSetting)
      .mockResolvedValueOnce({ key: INVITE_MODE_SETTING_KEY, value: 'true' } as SystemSetting);
    repo.save.mockImplementation(async (x: SystemSetting) => x as SystemSetting);

    await service.isInviteModeEnabled();
    await service.setInviteModeEnabled(true);
    await expect(service.isInviteModeEnabled()).resolves.toBe(true);
    expect(repo.save).toHaveBeenCalled();
  });

  it('treats missing row as disabled', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.isInviteModeEnabled()).resolves.toBe(false);
  });

  it('cache expires after TTL', async () => {
    jest.useFakeTimers();
    repo.findOne.mockResolvedValue({ key: INVITE_MODE_SETTING_KEY, value: 'true' } as SystemSetting);

    await service.isInviteModeEnabled();
    jest.advanceTimersByTime(INVITE_MODE_CACHE_TTL_MS + 1);
    await service.isInviteModeEnabled();

    expect(repo.findOne).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
