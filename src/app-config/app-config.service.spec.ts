import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppConfigService } from './app-config.service';
import { AppConfigRepository } from './app-config.repository';
import { CacheService } from '../cache/cache.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AdminConfigGateway } from './admin-config.gateway';
import { APP_CONFIG_DEFAULTS } from './default-config.registry';
import { AppConfig } from './entities/app-config.entity';
import { AppConfigValueType } from './constants';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let repository: jest.Mocked<AppConfigRepository>;
  let cache: jest.Mocked<CacheService>;
  let auditLog: jest.Mocked<AuditLogService>;
  let gateway: jest.Mocked<AdminConfigGateway>;
  let dataSource: jest.Mocked<DataSource>;

  const mockAuditContext = {
    actorId: 'user-123',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  const mockConfig: AppConfig = {
    key: 'platform.maintenance_mode',
    value: true,
    valueType: AppConfigValueType.BOOLEAN,
    description: 'Maintenance mode',
    isPublic: true,
    updatedBy: 'admin-123',
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      findByKey: jest.fn(),
      upsertRow: jest.fn(),
      deleteByKey: jest.fn(),
    };

    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockAuditLog = {
      log: jest.fn(),
    };

    const mockGateway = {
      notifyConfigChanged: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: AppConfigRepository,
          useValue: mockRepository,
        },
        {
          provide: CacheService,
          useValue: mockCache,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLog,
        },
        {
          provide: AdminConfigGateway,
          useValue: mockGateway,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
    repository = module.get(AppConfigRepository);
    cache = module.get(CacheService);
    auditLog = module.get(AuditLogService);
    gateway = module.get(AdminConfigGateway);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all config entries', async () => {
      cache.get.mockResolvedValue(null);
      repository.findAll.mockResolvedValue([mockConfig]);
      cache.set.mockResolvedValue();

      const result = await service.getAll();

      expect(cache.get).toHaveBeenCalledWith('app_config:snapshot');
      expect(repository.findAll).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith(
        'app_config:snapshot',
        expect.any(Object),
        30
      );
      expect(result.entries).toHaveProperty('platform.maintenance_mode');
    });

    it('should return cached config when available', async () => {
      const cachedData = {
        'platform.maintenance_mode': {
          value: false,
          valueType: AppConfigValueType.BOOLEAN,
          description: 'When true, clients should surface a maintenance experience',
          isPublic: true,
          updatedBy: null,
          updatedAt: null,
        },
      };
      cache.get.mockResolvedValue(cachedData);

      const result = await service.getAll();

      expect(cache.get).toHaveBeenCalledWith('app_config:snapshot');
      expect(repository.findAll).not.toHaveBeenCalled();
      expect(result.entries).toEqual(cachedData);
    });
  });

  describe('getPublicConfig', () => {
    it('should return only public config values', async () => {
      const mergedData = {
        'platform.maintenance_mode': {
          value: true,
          valueType: AppConfigValueType.BOOLEAN,
          description: 'Maintenance mode',
          isPublic: true,
          updatedBy: null,
          updatedAt: null,
        },
        'limits.daily_transfer_cap_usd': {
          value: 10000,
          valueType: AppConfigValueType.NUMBER,
          description: 'Daily transfer cap',
          isPublic: false,
          updatedBy: null,
          updatedAt: null,
        },
      };
      cache.get.mockResolvedValue(mergedData);

      const result = await service.getPublicConfig();

      expect(result.values).toHaveProperty('platform.maintenance_mode');
      expect(result.values).not.toHaveProperty('limits.daily_transfer_cap_usd');
    });
  });

  describe('get', () => {
    it('should return specific config entry', async () => {
      const mergedData = {
        'platform.maintenance_mode': {
          value: true,
          valueType: AppConfigValueType.BOOLEAN,
          description: 'Maintenance mode',
          isPublic: true,
          updatedBy: null,
          updatedAt: null,
        },
      };
      cache.get.mockResolvedValue(mergedData);

      const result = await service.get('platform.maintenance_mode');

      expect(result.value).toBe(true);
      expect(result.valueType).toBe(AppConfigValueType.BOOLEAN);
      expect(result.isPublic).toBe(true);
    });

    it('should throw NotFoundException for unknown key', async () => {
      cache.get.mockResolvedValue({});

      await expect(service.get('unknown.key')).rejects.toThrow('Unknown config key: unknown.key');
    });
  });

  describe('set', () => {
    it('should update config value', async () => {
      cache.get.mockResolvedValue({});
      repository.findByKey.mockResolvedValue(null);
      repository.upsertRow.mockResolvedValue();
      cache.del.mockResolvedValue();
      auditLog.log.mockResolvedValue();

      const result = await service.set('platform.maintenance_mode', true, mockAuditContext);

      expect(repository.upsertRow).toHaveBeenCalledWith({
        key: 'platform.maintenance_mode',
        value: true,
        valueType: AppConfigValueType.BOOLEAN,
        description: 'When true, clients should surface a maintenance experience',
        isPublic: true,
        updatedBy: 'user-123',
      });
      expect(cache.del).toHaveBeenCalled();
      expect(gateway.notifyConfigChanged).toHaveBeenCalledWith(['platform.maintenance_mode']);
      expect(auditLog.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException for unknown key', async () => {
      await expect(service.set('unknown.key', true, mockAuditContext))
        .rejects.toThrow('Config key is not registered: unknown.key');
    });

    it('should throw BadRequestException for invalid value type', async () => {
      await expect(service.set('platform.maintenance_mode', 'not-a-boolean', mockAuditContext))
        .rejects.toThrow('Value must be a boolean');
    });
  });

  describe('bulkSet', () => {
    it('should update multiple config values atomically', async () => {
      const values = {
        'platform.maintenance_mode': false,
        'limits.max_attachment_mb': 50,
      };
      
      dataSource.transaction.mockImplementation(async (callback) => {
        await callback({ getRepository: () => ({ upsert: jest.fn().mockResolvedValue({}) } });
      });
      
      cache.get.mockResolvedValue({});
      cache.del.mockResolvedValue();
      auditLog.log.mockResolvedValue();

      const result = await service.bulkSet(values, mockAuditContext);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalled();
      expect(gateway.notifyConfigChanged).toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException for incomplete payload', async () => {
      const values = {
        'platform.maintenance_mode': false,
        // Missing other required keys
      };

      await expect(service.bulkSet(values, mockAuditContext))
        .rejects.toThrow('Bulk replace must include exactly all registered config keys');
    });
  });

  describe('deleteKey', () => {
    it('should delete config override', async () => {
      repository.findByKey.mockResolvedValue(mockConfig);
      repository.deleteByKey.mockResolvedValue();
      cache.del.mockResolvedValue();
      auditLog.log.mockResolvedValue();

      await service.deleteKey('platform.maintenance_mode', mockAuditContext);

      expect(repository.deleteByKey).toHaveBeenCalledWith('platform.maintenance_mode');
      expect(cache.del).toHaveBeenCalled();
      expect(gateway.notifyConfigChanged).toHaveBeenCalledWith(['platform.maintenance_mode']);
      expect(auditLog.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent override', async () => {
      repository.findByKey.mockResolvedValue(null);

      await expect(service.deleteKey('platform.maintenance_mode', mockAuditContext))
        .rejects.toThrow('No stored override for key: platform.maintenance_mode');
    });
  });

  describe('resetToDefault', () => {
    it('should reset all configs to default values', async () => {
      dataSource.transaction.mockImplementation(async (callback) => {
        await callback({ getRepository: () => ({ upsert: jest.fn().mockResolvedValue({}) } });
      });
      
      cache.del.mockResolvedValue();
      auditLog.log.mockResolvedValue();

      const result = await service.resetToDefault(mockAuditContext);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalled();
      expect(gateway.notifyConfigChanged).toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalled();
    });
  });

  describe('value validation', () => {
    it('should validate string values', async () => {
      await expect(service.set('platform.support_contact', 'test@example.com', mockAuditContext))
        .resolves.not.toThrow();
    });

    it('should validate number values', async () => {
      await expect(service.set('limits.max_attachment_mb', 25, mockAuditContext))
        .resolves.not.toThrow();
    });

    it('should validate boolean values', async () => {
      await expect(service.set('features.enable_referrals', true, mockAuditContext))
        .resolves.not.toThrow();
    });

    it('should reject invalid number ranges', async () => {
      await expect(service.set('limits.max_attachment_mb', 1000, mockAuditContext))
        .rejects.toThrow('limits.max_attachment_mb must be between 1 and 512');
    });
  });
});
