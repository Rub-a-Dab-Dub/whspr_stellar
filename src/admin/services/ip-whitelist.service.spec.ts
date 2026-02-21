import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpWhitelistService } from './ip-whitelist.service';
import { IpWhitelist } from '../entities/ip-whitelist.entity';
import { AuditLogService } from './audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';

describe('IpWhitelistService', () => {
  let service: IpWhitelistService;
  let repository: Repository<IpWhitelist>;
  let auditLogService: AuditLogService;

  const mockRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockAuditLogService = {
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpWhitelistService,
        {
          provide: getRepositoryToken(IpWhitelist),
          useValue: mockRepository,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<IpWhitelistService>(IpWhitelistService);
    repository = module.get<Repository<IpWhitelist>>(
      getRepositoryToken(IpWhitelist),
    );
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all whitelist entries', async () => {
      const mockEntries = [
        {
          id: '1',
          ipCidr: '192.168.1.0/24',
          description: 'Test',
          addedBy: 'user1',
        },
      ];
      mockRepository.find.mockResolvedValue(mockEntries);

      const result = await service.findAll();

      expect(result).toEqual(mockEntries);
      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: ['addedByUser'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('create', () => {
    it('should create a whitelist entry and log audit', async () => {
      const dto = { ipCidr: '192.168.1.100/32', description: 'Office IP' };
      const userId = 'user-123';
      const ipAddress = '10.0.0.1';
      const mockEntry = { id: 'entry-1', ...dto, addedBy: userId };

      mockRepository.create.mockReturnValue(mockEntry);
      mockRepository.save.mockResolvedValue(mockEntry);

      const result = await service.create(dto, userId, ipAddress);

      expect(result).toEqual(mockEntry);
      expect(mockRepository.create).toHaveBeenCalledWith({
        ipCidr: dto.ipCidr,
        description: dto.description,
        addedBy: userId,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockEntry);
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalledWith({
        eventType: AuditEventType.ADMIN,
        action: AuditAction.IP_WHITELIST_ADDED,
        actorUserId: userId,
        resourceType: 'ip_whitelist',
        resourceId: mockEntry.id,
        outcome: AuditOutcome.SUCCESS,
        severity: AuditSeverity.HIGH,
        details: `Added IP/CIDR ${dto.ipCidr} to whitelist`,
        metadata: { ipCidr: dto.ipCidr, description: dto.description },
      });
    });
  });

  describe('remove', () => {
    it('should remove a whitelist entry and log audit', async () => {
      const id = 'entry-1';
      const userId = 'user-123';
      const ipAddress = '10.0.0.1';
      const mockEntry = { id, ipCidr: '192.168.1.100/32', description: 'Test' };

      mockRepository.findOne.mockResolvedValue(mockEntry);
      mockRepository.remove.mockResolvedValue(mockEntry);

      await service.remove(id, userId, ipAddress);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(mockRepository.remove).toHaveBeenCalledWith(mockEntry);
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalledWith({
        eventType: AuditEventType.ADMIN,
        action: AuditAction.IP_WHITELIST_REMOVED,
        actorUserId: userId,
        resourceType: 'ip_whitelist',
        resourceId: id,
        outcome: AuditOutcome.SUCCESS,
        severity: AuditSeverity.HIGH,
        details: `Removed IP/CIDR ${mockEntry.ipCidr} from whitelist`,
        metadata: { ipCidr: mockEntry.ipCidr },
      });
    });

    it('should not log if entry does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await service.remove('non-existent', 'user-123', '10.0.0.1');

      expect(mockRepository.remove).not.toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).not.toHaveBeenCalled();
    });
  });
});
