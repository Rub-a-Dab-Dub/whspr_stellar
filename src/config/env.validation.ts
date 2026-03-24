import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Server
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),

  // Database
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_POOL_MIN: Joi.number().default(2),
  DATABASE_POOL_MAX: Joi.number().default(10),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // EVM
  EVM_RPC_URL: Joi.string().uri().required(),
  EVM_PRIVATE_KEY: Joi.string().required(),
  EVM_ACCOUNT_ADDRESS: Joi.string().required(),
  EVM_CONTRACT_ADDRESS: Joi.string().required(),
  EVM_NETWORK: Joi.string().valid('bnb', 'celo', 'base').default('base'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(10),

  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  // Stellar / Horizon
  STELLAR_HORIZON_MAINNET_URL: Joi.string()
    .uri()
    .default('https://horizon.stellar.org'),
  STELLAR_HORIZON_TESTNET_URL: Joi.string()
    .uri()
    .default('https://horizon-testnet.stellar.org'),
});
