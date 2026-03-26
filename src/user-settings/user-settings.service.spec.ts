import { UserSettingsRepository } from './user-settings.repository';
import { UserSettingsService } from './user-settings.service';
import { UserSettings } from './entities/user-settings.entity';
import { TwoFactorService } from '../two-factor/two-factor.service';

describe('UserSettingsService', () => {
  let service: UserSettingsService;
  let repository: jest.Mocked<UserSettingsRepository>;
  let twoFactorService: jest.Mocked<TwoFactorService>;

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

    twoFactorService = {
      isEnabled: jest.fn(),
      removeAllForUser: jest.fn(),
    } as unknown as jest.Mocked<TwoFactorService>;

    service = new UserSettingsService(repository, twoFactorService);
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
    twoFactorService.isEnabled.mockResolvedValue(false);
    const result = await service.updateSettings('u1', { theme: 'dark' });
    expect(result.theme).toBe('dark');
  });

  it('resets settings to defaults and clears 2FA module state', async () => {
    repository.findByUserId.mockResolvedValue({
      ...mockSettings,
      theme: 'dark',
      twoFactorEnabled: true,
      twoFactorSecret: 'ABCD',
    });
    repository.save.mockImplementation(async (value) => value as UserSettings);
    twoFactorService.removeAllForUser.mockResolvedValue(undefined);

    const result = await service.resetSettings('u1');
    expect(result.theme).toBe('system');
    expect(result.twoFactorEnabled).toBe(false);
    expect(twoFactorService.removeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('checks notification preference by channel', async () => {
    repository.findByUserId.mockResolvedValue(mockSettings);
    const enabled = await service.isNotificationEnabled('u1', 'messages', 'inApp');
    expect(enabled).toBe(true);
  });
});
