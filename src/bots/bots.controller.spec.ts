import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';

describe('BotsController', () => {
  let controller: BotsController;
  let service: jest.Mocked<BotsService>;

  beforeEach(() => {
    service = {
      createBot: jest.fn(),
      getBots: jest.fn(),
      updateBot: jest.fn(),
      deleteBot: jest.fn(),
      addToGroup: jest.fn(),
      removeFromGroup: jest.fn(),
    } as unknown as jest.Mocked<BotsService>;

    controller = new BotsController(service);
  });

  it('delegates create/get/update/delete bot operations', async () => {
    service.createBot.mockResolvedValue({ id: 'bot-1' } as any);
    service.getBots.mockResolvedValue([]);
    service.updateBot.mockResolvedValue({ id: 'bot-1' } as any);
    service.deleteBot.mockResolvedValue(undefined);

    await controller.createBot('owner-1', {
      name: 'Helper',
      username: 'helper_bot',
      webhookUrl: 'https://example.com/hook',
      webhookSecret: 'secret',
      scopes: ['commands:read'],
    });
    await controller.getBots('owner-1');
    await controller.updateBot('owner-1', 'bot-1', { name: 'Helper 2' });
    await controller.deleteBot('owner-1', 'bot-1');

    expect(service.createBot).toHaveBeenCalledWith('owner-1', expect.any(Object));
    expect(service.getBots).toHaveBeenCalledWith('owner-1');
    expect(service.updateBot).toHaveBeenCalledWith('owner-1', 'bot-1', { name: 'Helper 2' });
    expect(service.deleteBot).toHaveBeenCalledWith('owner-1', 'bot-1');
  });

  it('delegates add/remove group bot operations', async () => {
    service.addToGroup.mockResolvedValue({
      groupId: 'group-1',
      botId: 'bot-1',
      name: 'Helper',
      username: 'helper_bot',
      avatarUrl: null,
      isBot: true,
    });
    service.removeFromGroup.mockResolvedValue(undefined);

    await controller.addBotToGroup('owner-1', 'group-1', { botId: 'bot-1' });
    await controller.removeBotFromGroup('owner-1', 'group-1', 'bot-1');

    expect(service.addToGroup).toHaveBeenCalledWith('owner-1', 'group-1', 'bot-1');
    expect(service.removeFromGroup).toHaveBeenCalledWith('owner-1', 'group-1', 'bot-1');
  });
});
