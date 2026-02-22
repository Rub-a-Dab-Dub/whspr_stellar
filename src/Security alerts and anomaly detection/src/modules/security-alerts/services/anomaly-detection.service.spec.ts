import { Test, TestingModule } from '@nestjs/testing';
import { SecurityAlertService } from '../services/security-alert.service';
import { AnomalyDetectionService } from '../services/anomaly-detection.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SecurityAlert } from '../entities/security-alert.entity';

describe('AnomalyDetectionService', () => {
  let service: AnomalyDetectionService;
  let alertService: SecurityAlertService;
  let module: TestingModule;

  beforeEach(async () => {
    const mockRepository = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
    };

    module = await Test.createTestingModule({
      providers: [
        AnomalyDetectionService,
        SecurityAlertService,
        {
          provide: getRepositoryToken(SecurityAlert),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AnomalyDetectionService>(AnomalyDetectionService);
    alertService = module.get<SecurityAlertService>(SecurityAlertService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('spam detection', () => {
    it('should detect spam when threshold is exceeded', async () => {
      const messages = Array.from({ length: 150 }, (_, i) => ({
        userId: 'user-123',
        timestamp: new Date(Date.now() - (100 - i) * 1000), // Within 100 seconds
      }));

      const createAlertSpy = jest.spyOn(alertService, 'createAlert');

      await service.checkSpamRule(messages);

      expect(createAlertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          rule: 'spam',
          severity: 'medium',
          userId: 'user-123',
        }),
      );
    });

    it('should not create alert when threshold not exceeded', async () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        userId: 'user-123',
        timestamp: new Date(Date.now() - (100 - i) * 1000),
      }));

      const createAlertSpy = jest.spyOn(alertService, 'createAlert');

      await service.checkSpamRule(messages);

      expect(createAlertSpy).not.toHaveBeenCalled();
    });
  });

  describe('wash trading detection', () => {
    it('should detect wash trading with many unique senders', async () => {
      const tips = Array.from({ length: 15 }, (_, i) => ({
        recipientId: 'user-123',
        senderId: `sender-${i}`,
        timestamp: new Date(Date.now() - (100 - i) * 1000),
      }));

      const createAlertSpy = jest.spyOn(alertService, 'createAlert');

      await service.checkWashTradingRule(tips);

      expect(createAlertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          rule: 'wash_trading',
          severity: 'high',
          userId: 'user-123',
        }),
      );
    });
  });

  describe('early withdrawal detection', () => {
    it('should detect withdrawals within 1 hour of registration', async () => {
      const withdrawalData = [
        {
          userId: 'user-123',
          registrationTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          withdrawalTime: new Date(),
        },
      ];

      const createAlertSpy = jest.spyOn(alertService, 'createAlert');

      await service.checkEarlyWithdrawalRule(withdrawalData);

      expect(createAlertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          rule: 'early_withdrawal',
          severity: 'high',
          userId: 'user-123',
        }),
      );
    });
  });

  describe('IP registration fraud detection', () => {
    it('should detect multiple accounts from same IP', async () => {
      const registrations = Array.from({ length: 10 }, (_, i) => ({
        userId: `user-${i}`,
        ipAddress: '192.168.1.1',
        registrationTime: new Date(Date.now() - (1000 - i * 100) * 1000),
      }));

      const createAlertSpy = jest.spyOn(alertService, 'createAlert');

      await service.checkIpRegistrationFraudRule(registrations);

      expect(createAlertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          rule: 'ip_registration_fraud',
          severity: 'medium',
          details: expect.objectContaining({
            ipAddress: '192.168.1.1',
            accountCount: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe('rule configuration', () => {
    it('should update rule configuration', () => {
      const updatedRule = service.updateRule('spam', {
        threshold: 200,
        severity: 'high',
      });

      expect(updatedRule.threshold).toBe(200);
      expect(updatedRule.severity).toBe('high');
    });

    it('should get all rules', () => {
      const rules = service.getRules();
      expect(rules).toHaveProperty('spam');
      expect(rules).toHaveProperty('wash_trading');
      expect(rules).toHaveProperty('early_withdrawal');
      expect(rules).toHaveProperty('ip_registration_fraud');
      expect(rules).toHaveProperty('admin_new_ip');
    });
  });
});
