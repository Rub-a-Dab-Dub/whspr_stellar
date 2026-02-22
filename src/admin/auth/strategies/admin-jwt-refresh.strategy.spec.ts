import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import { UserRole } from '../../../roles/entities/role.entity';
import { AdminJwtRefreshStrategy } from './admin-jwt-refresh.strategy';

describe('AdminJwtRefreshStrategy', () => {
  let strategy: AdminJwtRefreshStrategy;
  const configService = {
    get: jest.fn().mockReturnValue('refresh-secret'),
  } as unknown as ConfigService;
  const redisService = {
    get: jest.fn(),
  } as unknown as RedisService;

  const payload = {
    sub: 'admin-1',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    jti: 'jti-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new AdminJwtRefreshStrategy(configService, redisService);
  });

  it('throws when refresh token is missing', async () => {
    await expect(
      strategy.validate({ body: {} }, payload as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when stored token does not match', async () => {
    (redisService.get as jest.Mock).mockResolvedValue('stored-token');

    await expect(
      strategy.validate(
        { body: { refreshToken: 'provided-token' } },
        payload as any,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when payload role is not admin-capable', async () => {
    (redisService.get as jest.Mock).mockResolvedValue('provided-token');

    await expect(
      strategy.validate({ body: { refreshToken: 'provided-token' } }, {
        ...payload,
        role: UserRole.USER,
      } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns mapped admin payload for valid refresh token', async () => {
    (redisService.get as jest.Mock).mockResolvedValue('provided-token');

    await expect(
      strategy.validate(
        { body: { refreshToken: 'provided-token' } },
        payload as any,
      ),
    ).resolves.toEqual({
      adminId: 'admin-1',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
      jti: 'jti-1',
    });
  });
});
