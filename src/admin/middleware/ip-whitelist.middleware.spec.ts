import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { IpWhitelistMiddleware } from './ip-whitelist.middleware';
import { IpWhitelist } from '../entities/ip-whitelist.entity';

describe('IpWhitelistMiddleware', () => {
  let middleware: IpWhitelistMiddleware;
  let repository: Repository<IpWhitelist>;
  let configService: ConfigService;

  const mockRepository = {
    find: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockRequest = (ip: string, headers: any = {}) => ({
    headers,
    socket: { remoteAddress: ip },
  });

  const mockResponse = {};
  const mockNext = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpWhitelistMiddleware,
        {
          provide: getRepositoryToken(IpWhitelist),
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    middleware = module.get<IpWhitelistMiddleware>(IpWhitelistMiddleware);
    repository = module.get<Repository<IpWhitelist>>(
      getRepositoryToken(IpWhitelist),
    );
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when feature is disabled', () => {
    it('should allow all requests', async () => {
      mockConfigService.get.mockReturnValue('false');

      await middleware.use(
        mockRequest('1.2.3.4') as any,
        mockResponse as any,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('when feature is enabled', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('true');
    });

    it('should allow requests when whitelist is empty', async () => {
      mockRepository.find.mockResolvedValue([]);

      await middleware.use(
        mockRequest('1.2.3.4') as any,
        mockResponse as any,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow requests from whitelisted IP', async () => {
      mockRepository.find.mockResolvedValue([{ ipCidr: '192.168.1.100/32' }]);

      await middleware.use(
        mockRequest('192.168.1.100') as any,
        mockResponse as any,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow requests from whitelisted CIDR range', async () => {
      mockRepository.find.mockResolvedValue([{ ipCidr: '192.168.1.0/24' }]);

      await middleware.use(
        mockRequest('192.168.1.50') as any,
        mockResponse as any,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block requests from non-whitelisted IP', async () => {
      mockRepository.find.mockResolvedValue([{ ipCidr: '192.168.1.0/24' }]);

      await expect(
        middleware.use(
          mockRequest('10.0.0.1') as any,
          mockResponse as any,
          mockNext,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract IP from X-Forwarded-For header', async () => {
      mockRepository.find.mockResolvedValue([{ ipCidr: '1.2.3.4/32' }]);

      const req = mockRequest('127.0.0.1', {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      });

      await middleware.use(req as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract IP from X-Real-IP header', async () => {
      mockRepository.find.mockResolvedValue([{ ipCidr: '1.2.3.4/32' }]);

      const req = mockRequest('127.0.0.1', { 'x-real-ip': '1.2.3.4' });

      await middleware.use(req as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw error if client IP cannot be determined', async () => {
      mockRepository.find.mockResolvedValue([{ ipCidr: '192.168.1.0/24' }]);

      const req = { headers: {}, socket: {} };

      await expect(
        middleware.use(req as any, mockResponse as any, mockNext),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
