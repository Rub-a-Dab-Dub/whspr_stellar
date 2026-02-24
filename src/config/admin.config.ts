import { registerAs } from '@nestjs/config';

export default registerAs('admin', () => ({
  jwtSecret: process.env.ADMIN_JWT_SECRET,
  jwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN ?? '2h',
  jwtRefreshExpiresIn: process.env.ADMIN_JWT_REFRESH_EXPIRES_IN ?? '7d',
  maxLoginAttempts: parseInt(process.env.ADMIN_MAX_LOGIN_ATTEMPTS ?? '5', 10),
  lockoutDurationMs: parseInt(
    process.env.ADMIN_LOCKOUT_DURATION_MS ?? '1800000',
    10,
  ),
  rateLimitPerMinute: parseInt(
    process.env.ADMIN_RATE_LIMIT_PER_MINUTE ?? '60',
    10,
  ),
  largeTransactionThreshold: parseInt(
    process.env.ADMIN_LARGE_TRANSACTION_THRESHOLD ?? '10000',
    10,
  ),
}));
