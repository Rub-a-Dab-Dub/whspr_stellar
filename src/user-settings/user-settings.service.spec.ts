import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserSettingsRepository } from './user-settings.repository';
import { UserSettingsService } from './user-settings.service';
import { UserSettings } from './entities/user-settings.entity';

describe('UserSettingsService', () => {
  let service: UserSettingsService;
  let repository: jest.Mocked<UserSettingsRepository>;

  const mockSettings: UserSettings = {
    id: 's1',
    userId: 'u1',
    notificationPreferences: {
      messages: { push: true, email: false, inApp: true },
      mentions: { push: true, email: true, inApp: true },
      system: { push: false, email: true, inApp: true },
    },
    privacySettings: {
      lastSeenVisibility: 'everyone',
      readReceiptsEnabled: true,
      onlineStatusVisible: true,
    },
    theme: 'system',
    language: 'en',
    timezone: 'UTC',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<UserSettingsRepository>;

    service = new UserSettingsService(repository);
  });

  it('auto-creates settings with defaults', async () => {
    repository.findByUserId.mockResolvedValueOnce(null);
    repository.create.mockReturnValue(mockSettings);
    repository.save.mockResolvedValue(mockSettings);
    const result = await service.ensureSettingsForUser('u1');
    expect(result.userId).toBe('u1');
    expect(repository.create).toHaveBeenCalled();
  });

  it('updates settings', async () => {
    repository.findByUserId.mockResolvedValue(mockSettings);
    repository.save.mockResolvedValue({ ...mockSettings, theme: 'dark' });
    const result = await service.updateSettings('u1', { theme: 'dark' });
    expect(result.theme).toBe('dark');
  });

  it('resets settings to defaults', async () => {
    repository.findByUserId.mockResolvedValue({
      ...mockSettings,
      theme: 'dark',
      twoFactorEnabled: true,
      twoFactorSecret: 'ABCD',
    });
    repository.save.mockImplementation(async (value) => value as UserSettings);
    const result = await service.resetSettings('u1');
    expect(result.theme).toBe('system');
    expect(result.twoFactorEnabled).toBe(false);
  });

  it('2FA flow generates secret then validates code', async () => {
    repository.findByUserId.mockResolvedValue({ ...mockSettings, twoFactorSecret: null });
    repository.save.mockImplementation(async (value) => value as UserSettings);

    const setup = await service.enable2FA('u1', {});
    expect(setup.secret).toBeDefined();
    expect(setup.twoFactorEnabled).toBe(false);

    const withSecret = { ...mockSettings, twoFactorSecret: setup.secret!, twoFactorEnabled: false };
    repository.findByUserId.mockResolvedValue(withSecret);

    const code = (service as any).generateTotp(setup.secret!, Math.floor(Date.now() / 1000));
    const result = await service.enable2FA('u1', { code });
    expect(result.twoFactorEnabled).toBe(true);
  });

  it('throws for invalid 2FA code', async () => {
    repository.findByUserId.mockResolvedValue({
      ...mockSettings,
      twoFactorSecret: 'A'.repeat(40),
      twoFactorEnabled: false,
    });
    await expect(service.enable2FA('u1', { code: '000000' })).rejects.toThrow(UnauthorizedException);
  });

  it('requires code to disable enabled 2FA', async () => {
    repository.findByUserId.mockResolvedValue({
      ...mockSettings,
      twoFactorEnabled: true,
      twoFactorSecret: 'A'.repeat(40),
    });
    await expect(service.disable2FA('u1', {})).rejects.toThrow(BadRequestException);
  });

  it('checks notification preference by channel', async () => {
    repository.findByUserId.mockResolvedValue(mockSettings);
    const enabled = await service.isNotificationEnabled('u1', 'messages', 'inApp');
    expect(enabled).toBe(true);
  });
});
