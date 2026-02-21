import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import { AdminJwtPayload, AdminJwtStrategy } from './admin-jwt.strategy';
import { UserRole } from '../../../roles/entities/role.entity';

describe('AdminJwtStrategy', () => {
  let strategy: AdminJwtStrategy;
  const configService = {
    get: jest.fn().mockReturnValue('secret'),
  } as unknown as ConfigService;
  const redisService = {
    exists: jest.fn(),
  } as unknown as RedisService;

  const payload: AdminJwtPayload = {
    sub: 'admin-1',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    jti: 'jti-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new AdminJwtStrategy(configService, redisService);
  });

  it('throws when token is blacklisted', async () => {
    (redisService.exists as jest.Mock).mockResolvedValue(1);

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws when role is not admin-capable', async () => {
    (redisService.exists as jest.Mock).mockResolvedValue(0);

    await expect(
      strategy.validate({ ...payload, role: UserRole.USER }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns mapped admin payload when valid', async () => {
    (redisService.exists as jest.Mock).mockResolvedValue(0);

    await expect(strategy.validate(payload)).resolves.toEqual({
      adminId: 'admin-1',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
      jti: 'jti-1',
    });
  });
});
