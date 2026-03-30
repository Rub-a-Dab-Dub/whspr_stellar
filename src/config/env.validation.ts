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
  THROTTLE_LIMIT_SHORT: Joi.number().default(3),
  THROTTLE_LIMIT_MEDIUM: Joi.number().default(60),
  THROTTLE_LIMIT_LONG: Joi.number().default(1000),

  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  ADMIN_USER_IDS: Joi.string().allow('').default(''),

  // Attachments / Storage
  STORAGE_PROVIDER: Joi.string().valid('s3', 'r2').default('s3'),
  STORAGE_BUCKET: Joi.string().required(),
  STORAGE_REGION: Joi.string().default('auto'),
  STORAGE_ENDPOINT: Joi.string().uri().optional(),
  STORAGE_ACCESS_KEY_ID: Joi.string().required(),
  STORAGE_SECRET_ACCESS_KEY: Joi.string().required(),
  STORAGE_PUBLIC_BASE_URL: Joi.string().uri().optional(),
  ATTACHMENT_PRESIGN_EXPIRY_SECONDS: Joi.number().default(300),
  ATTACHMENT_MAX_SIZE_FREE_BYTES: Joi.number().default(10485760),
  ATTACHMENT_MAX_SIZE_PREMIUM_BYTES: Joi.number().default(26214400),
  ATTACHMENT_MAX_SIZE_VIP_BYTES: Joi.number().default(52428800),
  ATTACHMENT_ALLOWED_MIME_TYPES: Joi.string().default(
    'image/jpeg,image/png,image/webp,image/gif,video/mp4,audio/mpeg,audio/wav,application/pdf',
  ),

  // Email
  EMAIL_PROVIDER: Joi.string().valid('sendgrid', 'zeptomail').default('sendgrid'),
  EMAIL_FROM_ADDRESS: Joi.string().email().default('noreply@example.com'),
  SENDGRID_API_KEY: Joi.string().allow('').optional(),
  ZEPTOMAIL_API_KEY: Joi.string().allow('').optional(),
  ZEPTOMAIL_API_URL: Joi.string().uri().optional(),
  APP_PUBLIC_URL: Joi.string().uri().default('https://app.whspr.example'),

  // Soroban RPC
  SOROBAN_RPC_URL: Joi.string().uri().required(),
  SOROBAN_CONTRACT_IDS: Joi.string().default(''), // comma-separated contract addresses
  // Stellar / Horizon
  STELLAR_HORIZON_MAINNET_URL: Joi.string().uri().default('https://horizon.stellar.org'),
  STELLAR_HORIZON_TESTNET_URL: Joi.string().uri().default('https://horizon-testnet.stellar.org'),

  // SEP-10 Web Authentication
  SEP10_SERVER_SECRET: Joi.string().required(),
  SEP10_HOME_DOMAIN: Joi.string().default('localhost'),
  SEP10_WEB_AUTH_ENDPOINT: Joi.string().uri().optional(),

  // SEP-24 Fiat On/Off Ramp
  SEP24_ANCHOR_URL: Joi.string().uri().optional(),
  SEP24_ANCHOR_API_KEY: Joi.string().allow('').optional(),

  // Scheduled Jobs
  JOB_BLOCKCHAIN_EVENT_POLLING_MS: Joi.number().default(5000),
  JOB_TRANSACTION_STATUS_SYNC_MS: Joi.number().default(30000),
  JOB_TOKEN_PRICE_REFRESH_MS: Joi.number().default(60000),
  JOB_NFT_SYNC_MS: Joi.number().default(600000),
  JOB_REFERRAL_REWARD_PROCESSING_MS: Joi.number().default(3600000),
  JOB_WEBHOOK_DELIVERY_RETRY_MS: Joi.number().default(300000),
  JOB_SESSION_CLEANUP_CRON: Joi.string().default('0 2 * * *'),
  JOB_TIER_EXPIRY_CHECK_CRON: Joi.string().default('0 0 * * *'),
  JOB_ANALYTICS_AGGREGATION_CRON: Joi.string().default('0 0 * * *'),
  JOB_AUDIT_LOG_CLEANUP_CRON: Joi.string().default('0 0 * * 0'),
  JOB_LOCK_TTL_MS: Joi.number().default(15000),

  // Soroban
  SOROBAN_RPC_URL: Joi.string().uri().default('https://soroban-testnet.stellar.org:443'),
  SOROBAN_NETWORK_PASSPHRASE: Joi.string().default('Test SDF Network ; September 2015'),
  SOROBAN_CONTRACT_IDS: Joi.string().required(),

  // Observability
  OTEL_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  OTEL_SERVICE_NAME: Joi.string().default('gasless-gossip-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string()
    .uri()
    .default('http://localhost:4318/v1/traces'),
});
