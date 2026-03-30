import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotificationDigestService } from './notification-digest.service';
import { NotificationDigest, DigestPeriod } from './entities/notification-digest.entity';
import { QuietHoursConfig } from './entities/quiet-hours-config.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { NotificationsGateway } from '../messaging/gateways/notifications.gateway';
import { MailService } from '../mail/mail.service';
import { InAppNotificationType } from '../notifications/entities/notification.entity';
import { EXEMPT_NOTIFICATION_TYPES } from './dto/set-quiet-hours.dto';

describe('NotificationDigestService', () => {
  let service: NotificationDigestService;
  let digestRepo: Repository<NotificationDigest>;
  let quietHoursRepo: Repository<QuietHoursConfig>;
  let userRepo: Repository<User>;
  let mailService: MailService;
  let notificationsGateway: NotificationsGateway;
  let queryBuilder: any;

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDigestService,
        {
          provide: getRepositoryToken(NotificationDigest),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(QuietHoursConfig),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: NotificationsRepository,
          useValue: {
            findByIdForUser: jest.fn(),
          },
        },
        {
          provide: NotificationsGateway,
          useValue: {
            sendNotification: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendDigestEmail: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<NotificationDigestService>(NotificationDigestService);
    digestRepo = module.get(getRepositoryToken(NotificationDigest));
    quietHoursRepo = module.get(getRepositoryToken(QuietHoursConfig));
    userRepo = module.get(getRepositoryToken(User));
    mailService = module.get(MailService);
    notificationsGateway = module.get(NotificationsGateway);
  });

  describe('isInQuietHours', () => {
    it('returns false if not enabled', async () => {
      jest.spyOn(quietHoursRepo, 'findOne').mockResolvedValue({ isEnabled: false } as any);
      const result = await service.isInQuietHours('user-1');
      expect(result).toBe(false);
    });

    it('handles normal window bounds correctly', async () => {
      jest.spyOn(service as any, 'getNowInTimezone').mockReturnValue('10:00');
      jest.spyOn(quietHoursRepo, 'findOne').mockResolvedValue({
        isEnabled: true,
        startTime: '09:00',
        endTime: '17:00',
      } as any);

      const result = await service.isInQuietHours('user-1');
      expect(result).toBe(true);
    });

    it('handles overnight window correctly', async () => {
      jest.spyOn(service as any, 'getNowInTimezone').mockReturnValue('23:00');
      jest.spyOn(quietHoursRepo, 'findOne').mockResolvedValue({
        isEnabled: true,
        startTime: '22:00',
        endTime: '08:00',
      } as any);

      const result = await service.isInQuietHours('user-1');
      expect(result).toBe(true);
    });
  });

  describe('queueForDigest', () => {
    it('creates new digest if none pending', async () => {
      jest.spyOn(digestRepo, 'findOne').mockResolvedValue(null);
      const createSpy = jest.spyOn(digestRepo, 'create').mockReturnValue({ id: 'd-1' } as any);
      const saveSpy = jest.spyOn(digestRepo, 'save');

      await service.queueForDigest('u-1', 'n-1');

      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-1' }));
      expect(saveSpy).toHaveBeenCalled();
    });

    it('appends to existing digest', async () => {
      const digest = { id: 'd-1', notificationIds: ['n-1'] };
      jest.spyOn(digestRepo, 'findOne').mockResolvedValue(digest as any);
      const saveSpy = jest.spyOn(digestRepo, 'save');

      await service.queueForDigest('u-1', 'n-2');

      expect(digest.notificationIds).toContain('n-2');
      expect(saveSpy).toHaveBeenCalledWith(digest);
    });
  });

  describe('isExemptType', () => {
    it('returns true for TRANSFER_RECEIVED', () => {
      expect(
        service.isExemptType(InAppNotificationType.TRANSFER_RECEIVED, [...EXEMPT_NOTIFICATION_TYPES]),
      ).toBe(true);
    });

    it('returns false for NEW_MESSAGE', () => {
      expect(
        service.isExemptType(InAppNotificationType.NEW_MESSAGE, [...EXEMPT_NOTIFICATION_TYPES]),
      ).toBe(false);
    });
  });
});
