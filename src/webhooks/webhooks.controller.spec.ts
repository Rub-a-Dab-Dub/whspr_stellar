import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: jest.Mocked<WebhooksService>;

  beforeEach(() => {
    service = {
      createWebhook: jest.fn(),
      getWebhooks: jest.fn(),
      updateWebhook: jest.fn(),
      deleteWebhook: jest.fn(),
      getDeliveries: jest.fn(),
    } as unknown as jest.Mocked<WebhooksService>;

    controller = new WebhooksController(service);
  });

  it('delegates createWebhook', async () => {
    service.createWebhook.mockResolvedValue({ id: 'w1' } as any);
    await controller.createWebhook('u1', { url: 'https://a.com', secret: 'sec', events: ['x'] });
    expect(service.createWebhook).toHaveBeenCalledWith('u1', {
      url: 'https://a.com',
      secret: 'sec',
      events: ['x'],
    });
  });

  it('delegates list/update/delete/getDeliveries', async () => {
    service.getWebhooks.mockResolvedValue([]);
    service.updateWebhook.mockResolvedValue({ id: 'w1' } as any);
    service.deleteWebhook.mockResolvedValue(undefined);
    service.getDeliveries.mockResolvedValue([]);

    await controller.getWebhooks('u1');
    await controller.updateWebhook('u1', 'w1', { isActive: false });
    await controller.deleteWebhook('u1', 'w1');
    await controller.getDeliveries('u1', 'w1');

    expect(service.getWebhooks).toHaveBeenCalledWith('u1');
    expect(service.updateWebhook).toHaveBeenCalledWith('u1', 'w1', { isActive: false });
    expect(service.deleteWebhook).toHaveBeenCalledWith('u1', 'w1');
    expect(service.getDeliveries).toHaveBeenCalledWith('u1', 'w1');
  });
});
