import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigAdminController } from './app-config-admin.controller';
import { AppConfigService } from './app-config.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppConfigEntryDto, AppConfigMapResponseDto } from './dto/app-config-response.dto';
import { AppConfigValueType } from './constants';

describe('AppConfigAdminController', () => {
  let controller: AppConfigAdminController;
  let service: jest.Mocked<AppConfigService>;

  const mockUser = { id: 'admin-123' };
  const mockRequest = {
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'test-agent',
      'x-forwarded-for': '192.168.1.1',
    },
  };

  const mockConfigEntry: AppConfigEntryDto = {
    value: true,
    valueType: AppConfigValueType.BOOLEAN,
    description: 'Maintenance mode',
    isPublic: true,
    updatedBy: 'admin-123',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockConfigMap: AppConfigMapResponseDto = {
    entries: {
      'platform.maintenance_mode': mockConfigEntry,
    },
  };

  beforeEach(async () => {
    const mockAppConfigService = {
      getAll: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      bulkSet: jest.fn(),
      resetToDefault: jest.fn(),
      deleteKey: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppConfigAdminController],
      providers: [
        {
          provide: AppConfigService,
          useValue: mockAppConfigService,
        },
      ],
    }).compile();

    controller = module.get<AppConfigAdminController>(AppConfigAdminController);
    service = module.get(AppConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all config entries', async () => {
      service.getAll.mockResolvedValue(mockConfigMap);

      const result = await controller.getAll();

      expect(service.getAll).toHaveBeenCalled();
      expect(result).toEqual(mockConfigMap);
    });
  });

  describe('patchOne', () => {
    it('should update a single config key', async () => {
      const patchDto = { value: false };
      const decodedKey = 'platform.maintenance_mode';
      
      service.set.mockResolvedValue(mockConfigEntry);

      const result = await controller.patchOne(
        decodedKey,
        patchDto,
        mockUser.id,
        mockRequest as any
      );

      expect(service.set).toHaveBeenCalledWith(
        decodedKey,
        false,
        {
          actorId: mockUser.id,
          ipAddress: '192.168.1.1',
          userAgent: 'test-agent',
        }
      );
      expect(result).toEqual(mockConfigEntry);
    });

    it('should handle URL encoded keys', async () => {
      const patchDto = { value: 'test@example.com' };
      const encodedKey = 'platform.support%20contact';
      const decodedKey = 'platform.support contact';
      
      service.set.mockResolvedValue(mockConfigEntry);

      await controller.patchOne(encodedKey, patchDto, mockUser.id, mockRequest as any);

      expect(service.set).toHaveBeenCalledWith(
        decodedKey,
        'test@example.com',
        expect.any(Object)
      );
    });

    it('should propagate service errors', async () => {
      const patchDto = { value: 'invalid' };
      service.set.mockRejectedValue(new BadRequestException('Invalid value'));

      await expect(
        controller.patchOne('platform.maintenance_mode', patchDto, mockUser.id, mockRequest as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkReplace', () => {
    it('should replace all config values atomically', async () => {
      const bulkDto = { values: { 'platform.maintenance_mode': false } };
      
      service.bulkSet.mockResolvedValue(mockConfigMap);

      const result = await controller.bulkReplace(
        bulkDto,
        mockUser.id,
        mockRequest as any
      );

      expect(service.bulkSet).toHaveBeenCalledWith(
        { 'platform.maintenance_mode': false },
        {
          actorId: mockUser.id,
          ipAddress: '192.168.1.1',
          userAgent: 'test-agent',
        }
      );
      expect(result).toEqual(mockConfigMap);
    });

    it('should propagate service errors', async () => {
      const bulkDto = { values: {} };
      service.bulkSet.mockRejectedValue(new BadRequestException('Incomplete payload'));

      await expect(
        controller.bulkReplace(bulkDto, mockUser.id, mockRequest as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reset', () => {
    it('should reset all configs to defaults', async () => {
      service.resetToDefault.mockResolvedValue(mockConfigMap);

      const result = await controller.reset(mockUser.id, mockRequest as any);

      expect(service.resetToDefault).toHaveBeenCalledWith({
        actorId: mockUser.id,
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      });
      expect(result).toEqual(mockConfigMap);
    });

    it('should propagate service errors', async () => {
      service.resetToDefault.mockRejectedValue(new Error('Reset failed'));

      await expect(
        controller.reset(mockUser.id, mockRequest as any)
      ).rejects.toThrow('Reset failed');
    });
  });

  describe('deleteOne', () => {
    it('should delete a config override', async () => {
      const key = 'platform.maintenance_mode';
      service.deleteKey.mockResolvedValue();

      await controller.deleteOne(key, mockUser.id, mockRequest as any);

      expect(service.deleteKey).toHaveBeenCalledWith(key, {
        actorId: mockUser.id,
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      });
    });

    it('should handle URL encoded keys', async () => {
      const encodedKey = 'platform.support%20contact';
      const decodedKey = 'platform.support contact';
      service.deleteKey.mockResolvedValue();

      await controller.deleteOne(encodedKey, mockUser.id, mockRequest as any);

      expect(service.deleteKey).toHaveBeenCalledWith(decodedKey, expect.any(Object));
    });

    it('should propagate service errors', async () => {
      const key = 'platform.maintenance_mode';
      service.deleteKey.mockRejectedValue(new NotFoundException('Config not found'));

      await expect(
        controller.deleteOne(key, mockUser.id, mockRequest as any)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('clientIp extraction', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const requestWithXF = {
        ...mockRequest,
        headers: {
          'x-forwarded-for': '192.168.1.1,10.0.0.1',
          'user-agent': 'test-agent',
        },
      };

      const controller = new AppConfigAdminController(service);
      const ip = (controller as any).clientIp(requestWithXF);

      expect(ip).toBe('192.168.1.1');
    });

    it('should fall back to req.ip when x-forwarded-for is missing', () => {
      const requestWithoutXF = {
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'test-agent',
        },
      };

      const controller = new AppConfigAdminController(service);
      const ip = (controller as any).clientIp(requestWithoutXF);

      expect(ip).toBe('127.0.0.1');
    });

    it('should return null when no IP is available', () => {
      const requestWithoutIP = {
        headers: {
          'user-agent': 'test-agent',
        },
      };

      const controller = new AppConfigAdminController(service);
      const ip = (controller as any).clientIp(requestWithoutIP);

      expect(ip).toBeNull();
    });
  });

  describe('userAgent extraction', () => {
    it('should extract user agent from headers', () => {
      const controller = new AppConfigAdminController(service);
      const userAgent = (controller as any).userAgent(mockRequest);

      expect(userAgent).toBe('test-agent');
    });

    it('should return null when user agent is missing', () => {
      const requestWithoutUA = {
        headers: {},
      };

      const controller = new AppConfigAdminController(service);
      const userAgent = (controller as any).userAgent(requestWithoutUA);

      expect(userAgent).toBeNull();
    });

    it('should return null when user agent is not a string', () => {
      const requestWithInvalidUA = {
        headers: {
          'user-agent': 123,
        },
      };

      const controller = new AppConfigAdminController(service);
      const userAgent = (controller as any).userAgent(requestWithInvalidUA);

      expect(userAgent).toBeNull();
    });
  });
});
