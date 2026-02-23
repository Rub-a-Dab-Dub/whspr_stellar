import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { XpBoostService, XP_BOOST_REDIS_KEY } from './xp-boost.service';
import { XpBoostEvent } from '../entities/xp-boost-event.entity';
import { AuditLogService } from './audit-log.service';
import { RedisService } from '../../redis/redis.service';
import { AuditAction } from '../entities/audit-log.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

const mockAuditLogService = () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
});

const mockRedisService = () => ({
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
});

const makeEvent = (overrides: Partial<XpBoostEvent> = {}): XpBoostEvent => ({
  id: 'event-1',
  name: 'Test Boost',
  multiplier: 2.0,
  appliesToActions: ['all'],
  startAt: new Date(Date.now() + 60_000),
  endAt: new Date(Date.now() + 3_600_000),
  isActive: false,
  createdById: 'admin-1',
  createdBy: null as any,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('XpBoostService', () => {
  let service: XpBoostService;
  let repo: jest.Mocked<Repository<XpBoostEvent>>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XpBoostService,
        { provide: getRepositoryToken(XpBoostEvent), useFactory: mockRepo },
        { provide: AuditLogService, useFactory: mockAuditLogService },
        { provide: RedisService, useFactory: mockRedisService },
      ],
    }).compile();

    service = module.get(XpBoostService);
    repo = module.get(getRepositoryToken(XpBoostEvent));
    auditLogService = module.get(AuditLogService);
    redisService = module.get(RedisService);
  });

  describe('create', () => {
    it('creates and saves a new event', async () => {
      const dto = {
        name: 'Double XP',
        multiplier: 2.0,
        appliesToActions: ['all'],
        startAt: new Date(Date.now() + 1000).toISOString(),
        endAt: new Date(Date.now() + 100_000).toISOString(),
      };
      const event = makeEvent();
      repo.create.mockReturnValue(event);
      repo.save.mockResolvedValue(event);

      const result = await service.create(dto, 'admin-1');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Double XP', isActive: false }),
      );
      expect(repo.save).toHaveBeenCalledWith(event);
      expect(result).toBe(event);
      expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.XP_BOOST_CREATED }),
      );
    });

    it('throws if endAt <= startAt', async () => {
      const now = new Date();
      await expect(
        service.create(
          {
            name: 'Bad',
            multiplier: 2.0,
            appliesToActions: ['all'],
            startAt: new Date(now.getTime() + 5000).toISOString(),
            endAt: new Date(now.getTime() + 1000).toISOString(),
          },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates a scheduled event', async () => {
      const event = makeEvent();
      repo.findOne.mockResolvedValue(event);
      repo.save.mockResolvedValue({ ...event, name: 'Updated' });

      const result = await service.update(
        'event-1',
        { name: 'Updated' },
        'admin-1',
      );

      expect(result.name).toBe('Updated');
      expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.XP_BOOST_UPDATED }),
      );
    });

    it('throws NotFoundException for unknown event', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update('bad-id', { name: 'x' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when event is active', async () => {
      repo.findOne.mockResolvedValue(makeEvent({ isActive: true }));
      await expect(
        service.update('event-1', { name: 'x' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when event is past', async () => {
      repo.findOne.mockResolvedValue(
        makeEvent({
          endAt: new Date(Date.now() - 1000),
          startAt: new Date(Date.now() - 10_000),
        }),
      );
      await expect(
        service.update('event-1', { name: 'x' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('removes a scheduled event', async () => {
      const event = makeEvent();
      repo.findOne.mockResolvedValue(event);
      repo.remove.mockResolvedValue(event);

      await service.remove('event-1', 'admin-1');

      expect(repo.remove).toHaveBeenCalledWith(event);
      expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.XP_BOOST_DELETED }),
      );
    });

    it('throws when event is active', async () => {
      repo.findOne.mockResolvedValue(makeEvent({ isActive: true }));
      await expect(service.remove('event-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when event is in the past', async () => {
      repo.findOne.mockResolvedValue(
        makeEvent({
          endAt: new Date(Date.now() - 1000),
          startAt: new Date(Date.now() - 10_000),
        }),
      );
      await expect(service.remove('event-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for unknown event', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-id', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activateEvent', () => {
    it('sets isActive=true and writes to Redis', async () => {
      const event = makeEvent({ isActive: false });
      repo.save.mockResolvedValue({ ...event, isActive: true });

      await service.activateEvent(event);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
      expect(redisService.set).toHaveBeenCalledWith(
        XP_BOOST_REDIS_KEY,
        expect.stringContaining('"multiplier":2'),
      );
      expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.XP_BOOST_ACTIVATED }),
      );
    });
  });

  describe('deactivateEvent', () => {
    it('sets isActive=false and removes from Redis', async () => {
      const event = makeEvent({ isActive: true });
      repo.save.mockResolvedValue({ ...event, isActive: false });

      await service.deactivateEvent(event);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      expect(redisService.del).toHaveBeenCalledWith(XP_BOOST_REDIS_KEY);
      expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.XP_BOOST_DEACTIVATED }),
      );
    });
  });
});
