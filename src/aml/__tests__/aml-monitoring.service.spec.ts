import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AmlMonitoringService } from '../aml-monitoring.service';
import { AmlFlagsRepository } from '../aml-flags.repository';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { AmlFlagType, AmlRiskLevel, AmlFlagStatus } from '../entities/aml.enums';
import { MailService } from '../../mail/mail.service';

describe('AmlMonitoringService', () => {
  let service: AmlMonitoringService;
  let repo: jest.Mocked<AmlFlagsRepository>;
  let queue: jest.Mocked<any>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BullModule.registerQueue({ name: 'aml-analysis' })],
      providers: [
        AmlMonitoringService,
        {
          provide: getRepositoryToken(AmlFlag),
          useValue: { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), count: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(10000) },
        },
        {
          provide: getQueueToken('aml-analysis'),
          useValue: { add: jest.fn() },
        },
        {
          provide: MailService,
          useValue: { sendAdminAlert: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AmlMonitoringService>(AmlMonitoringService);
    repo = module.get(getRepositoryToken(AmlFlag));
    queue = module.get(getQueueToken('aml-analysis'));
    mailService = module.get(MailService);
  });

  it('should flag large amount transaction', async () => {
    const tx = { id: 'tx1', amount: '20000', fromAddress: 'user1', status: 'CONFIRMED' } as Transaction;
    jest.spyOn(service as any, 'getUserRecentTxCount').mockResolvedValue(0);
    jest.spyOn(service as any, 'getStructuringPattern').mockResolvedValue(0);

    const flag = await service.analyzeTransaction(tx as any);

    expect(flag).not.toBeNull();
    expect(flag!.flagType).toBe(AmlFlagType.LARGE_AMOUNT);
    expect(flag!.riskLevel).toBe(AmlRiskLevel.HIGH);
    expect(repo.save).toHaveBeenCalled();
  });

  it('should review flag status', async () => {
    const flag = { id: 'flag1', status: AmlFlagStatus.OPEN } as any;
    repo.findOne.mockResolvedValue(flag);
    repo.save.mockResolvedValue({ ...flag, status: AmlFlagStatus.REVIEWED });

    const result = await service.reviewFlag('flag1', 'review', 'admin1');

    expect(result.status).toBe(AmlFlagStatus.REVIEWED);
  });

  it('should send critical email', async () => {
    const tx = { id: 'tx1' } as Transaction;
    const flag = { riskLevel: AmlRiskLevel.CRITICAL } as any;
    repo.save.mockResolvedValue(flag);

    await service['flagSuspicious']('tx1', 'user1', [], AmlRiskLevel.CRITICAL);

    expect(mailService.sendAdminAlert).toHaveBeenCalled();
  });
});

