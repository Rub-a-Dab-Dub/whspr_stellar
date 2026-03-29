import { Test, TestingModule } from '@nestjs/testing';
import { NotificationDigestController } from './notification-digest.controller';
import { NotificationDigestService } from './notification-digest.service';

describe('NotificationDigestController', () => {
  let controller: NotificationDigestController;
  let service: NotificationDigestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationDigestController],
      providers: [
        {
          provide: NotificationDigestService,
          useValue: {
            getQuietHoursConfig: jest.fn(),
            setQuietHours: jest.fn(),
            sendDigest: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationDigestController>(NotificationDigestController);
    service = module.get<NotificationDigestService>(NotificationDigestService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getQuietHours calls service', async () => {
    await controller.getQuietHours({ user: { userId: '123' } });
    expect(service.getQuietHoursConfig).toHaveBeenCalledWith('123');
  });

  it('setQuietHours calls service', async () => {
    const dto = { isEnabled: true, startTime: '22:00', endTime: '08:00', timezone: 'UTC' };
    await controller.setQuietHours({ user: { userId: '123' } }, dto);
    expect(service.setQuietHours).toHaveBeenCalledWith('123', dto);
  });

  it('sendNow calls service', async () => {
    await controller.sendNow({ user: { userId: '123' } });
    expect(service.sendDigest).toHaveBeenCalledWith('123');
  });
});
