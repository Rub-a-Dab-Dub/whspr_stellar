import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Server
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),

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
  ADMIN_USER_IDS: Joi.string().allow('').optional(),
  ADMIN_WALLET_ADDRESSES: Joi.string().allow('').optional(),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(10),

  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  // Stellar / Horizon
  STELLAR_HORIZON_MAINNET_URL: Joi.string().uri().default('https://horizon.stellar.org'),
  STELLAR_HORIZON_TESTNET_URL: Joi.string().uri().default('https://horizon-testnet.stellar.org'),

  // Scheduled Jobs
  JOB_BLOCKCHAIN_EVENT_POLLING_MS: Joi.number().default(5000),
  JOB_TRANSACTION_STATUS_SYNC_MS: Joi.number().default(30000),
  JOB_TOKEN_PRICE_REFRESH_MS: Joi.number().default(60000),
  JOB_NFT_SYNC_MS: Joi.number().default(600000),
  JOB_REFERRAL_REWARD_PROCESSING_MS: Joi.number().default(3600000),
  JOB_WEBHOOK_DELIVERY_RETRY_MS: Joi.number().default(300000),
  JOB_SESSION_CLEANUP_CRON: Joi.string().default('0 0 * * *'),
  JOB_TIER_EXPIRY_CHECK_CRON: Joi.string().default('0 0 * * *'),
  JOB_ANALYTICS_AGGREGATION_CRON: Joi.string().default('0 0 * * *'),
  JOB_AUDIT_LOG_CLEANUP_CRON: Joi.string().default('0 0 * * 0'),
  JOB_LOCK_TTL_MS: Joi.number().default(15000),

  // Observability
  OTEL_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  OTEL_SERVICE_NAME: Joi.string().default('gasless-gossip-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string()
    .uri()
    .default('http://localhost:4318/v1/traces'),
});
