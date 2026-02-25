/**
 * Application configuration factory. Loaded by ConfigModule and validated against env.schema.
 */
export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim()),

  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASS,
    database: process.env.DATABASE_NAME,
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE ?? '10', 10),
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  chains: {
    bnbRpcUrl: process.env.BNB_RPC_URL ?? 'https://bsc-dataseed.binance.org',
    celoRpcUrl: process.env.CELO_RPC_URL ?? 'https://forno.celo.org',
    baseRpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
  },
});

export type AppConfiguration = ReturnType<typeof configuration>;
