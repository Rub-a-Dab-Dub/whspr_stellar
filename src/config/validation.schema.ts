import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  EVM_RPC_URL: Joi.string().uri().required(),
  EVM_PRIVATE_KEY: Joi.string().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),
  PINATA_JWT: Joi.string().required(),
  PINATA_GATEWAY_URL: Joi.string().required(),

  // Per-chain RPC URLs (optional, falls back to defaults in chain registry)
  CHAIN_ETHEREUM_RPC_URL: Joi.string().uri().optional(),
  CHAIN_ETHEREUM_CONTRACT_ADDRESS: Joi.string().optional(),
  CHAIN_BNB_RPC_URL: Joi.string().uri().optional(),
  CHAIN_BNB_CONTRACT_ADDRESS: Joi.string().optional(),
  CHAIN_CELO_RPC_URL: Joi.string().uri().optional(),
  CHAIN_CELO_CONTRACT_ADDRESS: Joi.string().optional(),
  CHAIN_BASE_RPC_URL: Joi.string().uri().optional(),
  CHAIN_BASE_CONTRACT_ADDRESS: Joi.string().optional(),
  GGPAY_CONTRACT_ADDRESS: Joi.string().optional(),
});
