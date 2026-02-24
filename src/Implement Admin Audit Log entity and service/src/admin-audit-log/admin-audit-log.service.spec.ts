import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLogService } from './admin-audit-log.service';
import { AdminAuditLog } from './entities';
import { CreateAdminAuditLogDto, AdminAuditLogFilterDto } from './dto';
import { AdminAuditLogAction, AuditLogTargetType } from './enums';

describe('AdminAuditLogService', () => {
  let service: AdminAuditLogService;
  let repository: Repository<AdminAuditLog>;

  const mockAdminAuditLog = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    adminId: '550e8400-e29b-41d4-a716-446655440001',
    adminEmail: 'admin@test.com',
    action: AdminAuditLogAction.LOGIN,
    targetType: AuditLogTargetType.SYSTEM,
    targetId: null,
    metadata: null,
    ipAddress: '192.168.1.1',
    createdAt: new Date('2026-02-21'),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditLogService,
        {
          provide: getRepositoryToken(AdminAuditLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AdminAuditLogService>(AdminAuditLogService);
    repository = module.get<Repository<AdminAuditLog>>(
      getRepositoryToken(AdminAuditLog),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should successfully log an admin action', async () => {
      const createDto: CreateAdminAuditLogDto = {
        adminId: mockAdminAuditLog.adminId,
        adminEmail: mockAdminAuditLog.adminEmail,
        action: AdminAuditLogAction.LOGIN,
        targetType: AuditLogTargetType.SYSTEM,
        ipAddress: '192.168.1.1',
      };

      mockRepository.create.mockReturnValue({
        ...mockAdminAuditLog,
        ...createDto,
      });
      mockRepository.save.mockResolvedValue({
        ...mockAdminAuditLog,
        ...createDto,
      });

      await service.log(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle errors gracefully without throwing', async () => {
      const createDto: CreateAdminAuditLogDto = {
        adminId: 'test-admin',
        adminEmail: 'admin@test.com',
        action: AdminAuditLogAction.LOGIN,
        targetType: AuditLogTargetType.SYSTEM,
      };

      mockRepository.create.mockReturnValue(createDto);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(service.log(createDto)).resolves.not.toThrow();
    });

    it('should log with metadata', async () => {
      const createDto: CreateAdminAuditLogDto = {
        adminId: mockAdminAuditLog.adminId,
        adminEmail: mockAdminAuditLog.adminEmail,
        action: AdminAuditLogAction.BAN_USER,
        targetType: AuditLogTargetType.USER,
        targetId: 'user-123',
        metadata: { reason: 'Spam', duration: '30 days' },
        ipAddress: '192.168.1.1',
      };

      mockRepository.create.mockReturnValue(mockAdminAuditLog);
      mockRepository.save.mockResolvedValue(mockAdminAuditLog);

      await service.log(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs with default pagination', async () => {
      const filters: AdminAuditLogFilterDto = {
        page: 1,
        limit: 20,
      };

      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAdminAuditLog], 1]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll(filters);

      expect(result.data).toEqual([mockAdminAuditLog]);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        pages: 1,
      });
    });

    it('should filter by adminId', async () => {
      const filters: AdminAuditLogFilterDto = {
        adminId: mockAdminAuditLog.adminId,
        page: 1,
        limit: 20,
      };

      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAdminAuditLog], 1]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll(filters);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'auditLog.adminId = :adminId',
        { adminId: mockAdminAuditLog.adminId },
      );
      expect(result.data).toEqual([mockAdminAuditLog]);
    });

    it('should filter by action', async () => {
      const filters: AdminAuditLogFilterDto = {
        action: AdminAuditLogAction.LOGIN,
        page: 1,
        limit: 20,
      };

      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAdminAuditLog], 1]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll(filters);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'auditLog.action = :action',
        { action: AdminAuditLogAction.LOGIN },
      );
      expect(result.data).toEqual([mockAdminAuditLog]);
    });

    it('should filter by targetType', async () => {
      const filters: AdminAuditLogFilterDto = {
        targetType: AuditLogTargetType.USER,
        page: 1,
        limit: 20,
      };

      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAdminAuditLog], 1]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll(filters);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'auditLog.targetType = :targetType',
        { targetType: AuditLogTargetType.USER },
      );
      expect(result.data).toEqual([mockAdminAuditLog]);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2026-02-20');
      const endDate = new Date('2026-02-22');

      const filters: AdminAuditLogFilterDto = {
        startDate,
        endDate,
        page: 1,
        limit: 20,
      };

      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAdminAuditLog], 1]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll(filters);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'auditLog.createdAt >= :startDate',
        { startDate },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'auditLog.createdAt <= :endDate',
        { endDate },
      );
      expect(result.data).toEqual([mockAdminAuditLog]);
    });

    it('should apply default pagination when not specified', async () => {
      const filters: AdminAuditLogFilterDto = {
        page: 0,
        limit: 0,
      };

      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAdminAuditLog], 50]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll(filters);

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should calculate correct page count', async () => {
      const filters: AdminAuditLogFilterDto = {
        page: 1,
        limit: 10,
      };

      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 50]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll(filters);

      expect(result.pagination.pages).toBe(5);
    });
  });

  describe('findByAdminId', () => {
    it('should find logs by admin ID', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockAdminAuditLog], 1]);

      const result = await service.findByAdminId(mockAdminAuditLog.adminId);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { adminId: mockAdminAuditLog.adminId },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
      expect(result.data).toEqual([mockAdminAuditLog]);
      expect(result.total).toBe(1);
    });

    it('should support pagination for findByAdminId', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 100]);

      await service.findByAdminId(mockAdminAuditLog.adminId, 10, 5);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { adminId: mockAdminAuditLog.adminId },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('findById', () => {
    it('should find a log by ID', async () => {
      mockRepository.findOne.mockResolvedValue(mockAdminAuditLog);

      const result = await service.findById(mockAdminAuditLog.id);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockAdminAuditLog.id },
      });
      expect(result).toEqual(mockAdminAuditLog);
    });

    it('should return null if log not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('countByAction', () => {
    it('should count logs by action', async () => {
      mockRepository.count.mockResolvedValue(42);

      const result = await service.countByAction(AdminAuditLogAction.LOGIN);

      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { action: AdminAuditLogAction.LOGIN },
      });
      expect(result).toBe(42);
    });
  });

  describe('getAdminIds', () => {
    it('should get distinct admin IDs', async () => {
      const adminIds = [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
      ];
      mockRepository.query.mockResolvedValue(
        adminIds.map((id) => ({ adminId: id })),
      );

      const result = await service.getAdminIds();

      expect(result).toEqual(adminIds);
    });
  });

  describe('logBatch', () => {
    it('should batch log multiple actions', async () => {
      const batch: CreateAdminAuditLogDto[] = [
        {
          adminId: mockAdminAuditLog.adminId,
          adminEmail: mockAdminAuditLog.adminEmail,
          action: AdminAuditLogAction.LOGIN,
          targetType: AuditLogTargetType.SYSTEM,
        },
        {
          adminId: mockAdminAuditLog.adminId,
          adminEmail: mockAdminAuditLog.adminEmail,
          action: AdminAuditLogAction.LOGOUT,
          targetType: AuditLogTargetType.SYSTEM,
        },
      ];

      mockRepository.create.mockReturnValue([mockAdminAuditLog]);
      mockRepository.save.mockResolvedValue([mockAdminAuditLog]);

      await service.logBatch(batch);

      expect(mockRepository.create).toHaveBeenCalledWith(batch);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle batch logging errors gracefully', async () => {
      const batch: CreateAdminAuditLogDto[] = [
        {
          adminId: mockAdminAuditLog.adminId,
          adminEmail: mockAdminAuditLog.adminEmail,
          action: AdminAuditLogAction.LOGIN,
          targetType: AuditLogTargetType.SYSTEM,
        },
      ];

      mockRepository.create.mockReturnValue(batch);
      mockRepository.save.mockRejectedValue(new Error('Batch error'));

      // Should not throw
      await expect(service.logBatch(batch)).resolves.not.toThrow();
    });
  });
});
