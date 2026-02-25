import * as Joi from 'joi';

/**
 * Joi schema for environment variables. Validated on application startup.
 * Required vars must be set; optional ones get defaults when omitted.
 */
export const envSchema = Joi.object({
  // App
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3001),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),

  // Database (PostgreSQL)
  DATABASE_HOST: Joi.string().hostname().default('localhost'),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASS: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_POOL_SIZE: Joi.number().min(1).optional(),
  DATABASE_POOL_MIN: Joi.number().min(0).optional(),

  // Redis
  REDIS_HOST: Joi.string().hostname().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // JWT
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Chain RPC (optional with defaults for health)
  BNB_RPC_URL: Joi.string().uri().optional(),
  CELO_RPC_URL: Joi.string().uri().optional(),
  BASE_RPC_URL: Joi.string().uri().optional(),

  // Stellar / Soroban (optional)
  STELLAR_HORIZON_URL: Joi.string().uri().optional(),
  STELLAR_NETWORK_PASSPHRASE: Joi.string().optional(),
  SOROBAN_RPC_URL: Joi.string().uri().optional(),
  SOROBAN_CONTRACT_ID: Joi.string().optional(),
  STELLAR_SENDER_SECRET_KEY: Joi.string().optional(),

  // EVM
  EVM_RPC_URL: Joi.string().uri().optional(),

  // IPFS / Pinata (optional)
  PINATA_JWT: Joi.string().optional(),
  PINATA_GATEWAY: Joi.string().uri().optional(),
  IPFS_GATEWAY_URL: Joi.string().uri().optional(),
  IPFS_HTTP_URL: Joi.string().uri().optional(),

  // Rate limit (optional)
  RATE_LIMIT_USER: Joi.number().optional(),
  RATE_LIMIT_USER_WINDOW_MS: Joi.number().optional(),
  RATE_LIMIT_IP: Joi.number().optional(),
  RATE_LIMIT_IP_WINDOW_MS: Joi.number().optional(),

  // Admin / app (optional)
  ADMIN_WALLET_ADDRESS: Joi.string().optional(),
  PAYMENT_CONTRACT_ADDRESS: Joi.string().optional(),
  TREASURY_WALLET_ADDRESS: Joi.string().optional(),
  CORS_ORIGIN: Joi.string().optional(),
});

export type EnvSchema = Joi.Schema & { _env: Record<string, unknown> };
