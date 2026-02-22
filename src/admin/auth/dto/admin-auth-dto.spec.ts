import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminLoginDto } from './admin-login.dto';
import { AdminRefreshTokenDto } from './admin-refresh-token.dto';

describe('AdminAuth DTOs', () => {
  it('validates AdminLoginDto', async () => {
    const valid = plainToInstance(AdminLoginDto, {
      email: 'admin@example.com',
      password: 'Password123!',
    });
    const invalid = plainToInstance(AdminLoginDto, {
      email: 'bad-email',
      password: '',
    });

    expect((await validate(valid)).length).toBe(0);
    expect((await validate(invalid)).length).toBeGreaterThan(0);
  });

  it('validates AdminRefreshTokenDto', async () => {
    const valid = plainToInstance(AdminRefreshTokenDto, {
      refreshToken: 'refresh-token',
    });
    const invalid = plainToInstance(AdminRefreshTokenDto, {
      refreshToken: '',
    });

    expect((await validate(valid)).length).toBe(0);
    expect((await validate(invalid)).length).toBeGreaterThan(0);
  });
});
