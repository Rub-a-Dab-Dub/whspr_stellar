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
    } as unknown as jest.Mocked<UserSettingsService>;

    controller = new UserSettingsController(service);
  });

  it('delegates CRUD methods', async () => {
    service.getSettings.mockResolvedValue({} as any);
    service.updateSettings.mockResolvedValue({} as any);
    service.resetSettings.mockResolvedValue({} as any);

    await controller.getSettings('u1');
    await controller.updateSettings('u1', { theme: 'dark' });
    await controller.resetSettings('u1');

    expect(service.getSettings).toHaveBeenCalledWith('u1');
    expect(service.updateSettings).toHaveBeenCalledWith('u1', { theme: 'dark' });
    expect(service.resetSettings).toHaveBeenCalledWith('u1');
  });
});
