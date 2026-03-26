import { UserSettingsController } from './user-settings.controller';
import { UserSettingsService } from './user-settings.service';

describe('UserSettingsController', () => {
  let controller: UserSettingsController;
  let service: jest.Mocked<UserSettingsService>;

  beforeEach(() => {
    service = {
      getSettings: jest.fn(),
      updateSettings: jest.fn(),
      resetSettings: jest.fn(),
      enable2FA: jest.fn(),
      disable2FA: jest.fn(),
    } as unknown as jest.Mocked<UserSettingsService>;

    controller = new UserSettingsController(service);
  });

  it('delegates CRUD methods', async () => {
    service.getSettings.mockResolvedValue({} as any);
    service.updateSettings.mockResolvedValue({} as any);
    service.resetSettings.mockResolvedValue({} as any);
    service.enable2FA.mockResolvedValue({ twoFactorEnabled: false });
    service.disable2FA.mockResolvedValue(undefined);

    await controller.getSettings('u1');
    await controller.updateSettings('u1', { theme: 'dark' });
    await controller.resetSettings('u1');
    await controller.enableTwoFactor('u1', {});
    await controller.disableTwoFactor('u1', { code: '123456' });

    expect(service.getSettings).toHaveBeenCalledWith('u1');
    expect(service.updateSettings).toHaveBeenCalledWith('u1', { theme: 'dark' });
    expect(service.resetSettings).toHaveBeenCalledWith('u1');
    expect(service.enable2FA).toHaveBeenCalledWith('u1', {});
    expect(service.disable2FA).toHaveBeenCalledWith('u1', { code: '123456' });
  });
});
