import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecurringPaymentsService } from './recurring-payments.service';
import { RecurringPayment, RecurringPaymentStatus, PaymentFrequency } from './entities/recurring-payment.entity';
import { RecurringPaymentRun, RunStatus } from './entities/recurring-payment-run.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RedlockService } from '../cache/redlock.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((v: unknown) => v),
  save: jest.fn((v: unknown) => Promise.resolve(v)),
  createQueryBuilder: jest.fn(),
});

const SENDER_ID = 'sender-uuid';
const RP_ID = 'rp-uuid';

const baseRp = (): RecurringPayment =>
  ({
    id: RP_ID,
    senderId: SENDER_ID,
    recipientAddress: 'GBXXX',
    tokenId: null,
    amount: '10.0000000',
    frequency: PaymentFrequency.WEEKLY,
    nextRunAt: new Date(Date.now() - 1000),
    lastRunAt: null,
    totalRuns: 0,
    maxRuns: null,
    consecutiveFailures: 0,
    status: RecurringPaymentStatus.ACTIVE,
    createdAt: new Date(),
  }) as RecurringPayment;

describe('RecurringPaymentsService', () => {
  let service: RecurringPaymentsService;
  let rpRepo: ReturnType<typeof mockRepo>;
  let runRepo: ReturnType<typeof mockRepo>;
  let notifications: jest.Mocked<NotificationsService>;
  let redlock: jest.Mocked<RedlockService>;

  beforeEach(async () => {
    rpRepo = mockRepo();
    runRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringPaymentsService,
        { provide: getRepositoryToken(RecurringPayment), useValue: rpRepo },
        { provide: getRepositoryToken(RecurringPaymentRun), useValue: runRepo },
        {
          provide: NotificationsService,
          useValue: { createNotification: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: RedlockService,
          useValue: {
            withLock: jest.fn((_r: string, _t: number, fn: () => Promise<unknown>) => fn()),
          },
        },
      ],
    }).compile();

    service = module.get(RecurringPaymentsService);
    notifications = module.get(NotificationsService) as jest.Mocked<NotificationsService>;
    redlock = module.get(RedlockService) as jest.Mocked<RedlockService>;
  });

  // ── createRecurring ──────────────────────────────────────────────────────────

  describe('createRecurring', () => {
    it('creates and returns a recurring payment', async () => {
      const rp = baseRp();
      rpRepo.save.mockResolvedValue(rp);

      const result = await service.createRecurring(SENDER_ID, {
        recipientAddress: 'GBXXX',
        amount: '10.0000000',
        frequency: PaymentFrequency.WEEKLY,
        startAt: new Date(Date.now() + 60000).toISOString(),
      });

      expect(rpRepo.save).toHaveBeenCalled();
      expect(result.senderId).toBe(SENDER_ID);
    });

    it('throws BadRequestException for invalid startAt', async () => {
      await expect(
        service.createRecurring(SENDER_ID, {
          recipientAddress: 'GBXXX',
          amount: '10',
          frequency: PaymentFrequency.DAILY,
          startAt: 'not-a-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getRecurringPayments ─────────────────────────────────────────────────────

  describe('getRecurringPayments', () => {
    it('returns list of payments for sender', async () => {
      rpRepo.find.mockResolvedValue([baseRp()]);
      const result = await service.getRecurringPayments(SENDER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(RP_ID);
    });
  });

  // ── pauseRecurring ───────────────────────────────────────────────────────────

  describe('pauseRecurring', () => {
    it('pauses an active payment', async () => {
      const rp = baseRp();
      rpRepo.findOne.mockResolvedValue(rp);
      rpRepo.save.mockResolvedValue({ ...rp, status: RecurringPaymentStatus.PAUSED });

      const result = await service.pauseRecurring(SENDER_ID, RP_ID);
      expect(rpRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(RecurringPaymentStatus.PAUSED);
    });

    it('throws if payment is not ACTIVE', async () => {
      rpRepo.findOne.mockResolvedValue({ ...baseRp(), status: RecurringPaymentStatus.PAUSED });
      await expect(service.pauseRecurring(SENDER_ID, RP_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException for wrong owner', async () => {
      rpRepo.findOne.mockResolvedValue({ ...baseRp(), senderId: 'other-user' });
      await expect(service.pauseRecurring(SENDER_ID, RP_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown id', async () => {
      rpRepo.findOne.mockResolvedValue(null);
      await expect(service.pauseRecurring(SENDER_ID, RP_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── resumeRecurring ──────────────────────────────────────────────────────────

  describe('resumeRecurring', () => {
    it('resumes a paused payment', async () => {
      const rp = { ...baseRp(), status: RecurringPaymentStatus.PAUSED };
      rpRepo.findOne.mockResolvedValue(rp);
      rpRepo.save.mockResolvedValue({ ...rp, status: RecurringPaymentStatus.ACTIVE });

      const result = await service.resumeRecurring(SENDER_ID, RP_ID);
      expect(result.status).toBe(RecurringPaymentStatus.ACTIVE);
    });

    it('throws if payment is not PAUSED', async () => {
      rpRepo.findOne.mockResolvedValue(baseRp()); // ACTIVE
      await expect(service.resumeRecurring(SENDER_ID, RP_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ── cancelRecurring ──────────────────────────────────────────────────────────

  describe('cancelRecurring', () => {
    it('cancels an active payment', async () => {
      rpRepo.findOne.mockResolvedValue(baseRp());
      await expect(service.cancelRecurring(SENDER_ID, RP_ID)).resolves.toBeUndefined();
      expect(rpRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RecurringPaymentStatus.CANCELLED }),
      );
    });

    it('throws if already cancelled', async () => {
      rpRepo.findOne.mockResolvedValue({ ...baseRp(), status: RecurringPaymentStatus.CANCELLED });
      await expect(service.cancelRecurring(SENDER_ID, RP_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ── getRunHistory ────────────────────────────────────────────────────────────

  describe('getRunHistory', () => {
    it('returns run history for owned payment', async () => {
      rpRepo.findOne.mockResolvedValue(baseRp());
      runRepo.find.mockResolvedValue([
        {
          id: 'run-1',
          recurringPaymentId: RP_ID,
          txHash: 'hash123',
          status: RunStatus.SUCCESS,
          amount: '10.0000000',
          errorMessage: null,
          executedAt: new Date(),
        },
      ]);

      const result = await service.getRunHistory(SENDER_ID, RP_ID);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(RunStatus.SUCCESS);
    });
  });

  // ── processDue ───────────────────────────────────────────────────────────────

  describe('processDue', () => {
    it('acquires distributed lock and processes due payments', async () => {
      const rp = baseRp();
      rpRepo.find.mockResolvedValue([rp]);
      rpRepo.save.mockResolvedValue({ ...rp, totalRuns: 1 });
      runRepo.save.mockResolvedValue({});

      await service.processDue();

      expect(redlock.withLock).toHaveBeenCalledWith(
        'lock:recurring-payments:process',
        expect.any(Number),
        expect.any(Function),
      );
      expect(runRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RunStatus.SUCCESS }),
      );
    });

    it('marks payment COMPLETED when maxRuns reached', async () => {
      const rp = { ...baseRp(), totalRuns: 11, maxRuns: 12 };
      rpRepo.find.mockResolvedValue([rp]);
      runRepo.save.mockResolvedValue({});

      let savedRp: Partial<RecurringPayment> = {};
      rpRepo.save.mockImplementation((v: RecurringPayment) => {
        savedRp = v;
        return Promise.resolve(v);
      });

      await service.processDue();
      expect(savedRp.status).toBe(RecurringPaymentStatus.COMPLETED);
    });

    it('increments consecutiveFailures on error', async () => {
      const rp = { ...baseRp(), consecutiveFailures: 1 };
      rpRepo.find.mockResolvedValue([rp]);
      runRepo.save.mockResolvedValue({});

      // Force submitTransfer to fail by spying on private method
      jest.spyOn(service as never, 'submitTransfer').mockRejectedValue(new Error('network error'));

      let savedRp: Partial<RecurringPayment> = {};
      rpRepo.save.mockImplementation((v: RecurringPayment) => {
        savedRp = v;
        return Promise.resolve(v);
      });

      await service.processDue();
      expect(savedRp.consecutiveFailures).toBe(2);
      expect(runRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RunStatus.FAILED }),
      );
    });

    it('auto-cancels after 3 consecutive failures and notifies', async () => {
      const rp = { ...baseRp(), consecutiveFailures: 2 };
      rpRepo.find.mockResolvedValue([rp]);
      runRepo.save.mockResolvedValue({});

      jest.spyOn(service as never, 'submitTransfer').mockRejectedValue(new Error('fail'));
      rpRepo.save.mockResolvedValue({});

      await service.processDue();

      expect(rpRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RecurringPaymentStatus.CANCELLED }),
      );
      expect(notifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Recurring Payment Cancelled' }),
      );
    });

    it('handles empty due list gracefully', async () => {
      rpRepo.find.mockResolvedValue([]);
      await expect(service.processDue()).resolves.toBeUndefined();
    });
  });

  // ── notifyUpcoming ───────────────────────────────────────────────────────────

  describe('notifyUpcoming', () => {
    it('sends notifications for payments due within 24h', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([baseRp()]),
      };
      rpRepo.createQueryBuilder.mockReturnValue(qb);

      await service.notifyUpcoming();

      expect(notifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Upcoming Recurring Payment' }),
      );
    });
  });
});
