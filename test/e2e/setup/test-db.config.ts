import { DataSourceOptions } from 'typeorm';

export const testDbConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? '127.0.0.1',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'gasless_gossip_test',
  entities: [__dirname + '/../../../src/**/*.entity{.ts,.js}'],
  synchronize: true,
  dropSchema: false,
  logging: false,
  extra: {
    connectionTimeoutMillis: 2000,
  },
};
